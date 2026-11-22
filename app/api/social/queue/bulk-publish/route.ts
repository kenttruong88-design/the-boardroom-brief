import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";
import { getBufferProfiles, scheduleBufferPost } from "@/app/lib/social/buffer-client";
import { POST_SPACING_MINUTES, planDays } from "@/app/lib/social/pick-posts";

export const maxDuration = 120;

interface QueueRow {
  id: string;
  platform: string;
  pillar: string | null;
  review_score: number | null;
  content: string;
  hashtags: string[] | null;
  image_url: string | null;
  scheduled_for: string;
  status: string;
}

// Approves everything awaiting approval under the SAME rules as the publish cron
// (see pick-posts.ts): per-platform daily caps, guaranteed pillars first, best-rated next.
// Today's share goes to Buffer now (spaced out, never all in the same minute); the rest is
// moved to later days at its original time-of-day, status "pending", and the cron sends it.
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as { mode?: "scheduled" | "now" };
  const mode = body.mode ?? "scheduled";

  const supabase = createAdminClient();

  const { data: posts, error: fetchErr } = await supabase
    .from("social_queue")
    .select("id, platform, pillar, review_score, content, hashtags, image_url, scheduled_for, status")
    .eq("status", "pending_approval")
    .is("buffer_post_id", null)
    .order("scheduled_for", { ascending: true });

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!posts || posts.length === 0) {
    return NextResponse.json({ sent: 0, deferred: 0, failed: 0, message: "No posts awaiting approval" });
  }

  // What each platform already has committed today (sent + pending + sending, scheduled today)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const { data: committedRows } = await supabase
    .from("social_queue")
    .select("platform, pillar")
    .in("status", ["sent", "sending", "pending"])
    .gte("scheduled_for", todayStart.toISOString())
    .lt("scheduled_for", todayEnd.toISOString());

  let profiles: Awaited<ReturnType<typeof getBufferProfiles>> = [];
  try {
    profiles = await getBufferProfiles();
  } catch (err) {
    return NextResponse.json({ error: `Buffer unavailable: ${(err as Error).message}` }, { status: 502 });
  }

  const now = new Date();

  // post id -> day offset, planned per platform
  const dayOf = new Map<string, number>();
  for (const platform of new Set((posts as QueueRow[]).map((p) => p.platform))) {
    const committed = { total: 0, byPillar: {} as Record<string, number> };
    for (const r of committedRows ?? []) {
      if (r.platform !== platform) continue;
      committed.total++;
      const pillar = (r.pillar as string | null) ?? "";
      committed.byPillar[pillar] = (committed.byPillar[pillar] ?? 0) + 1;
    }
    const plan = planDays((posts as QueueRow[]).filter((p) => p.platform === platform), platform, committed);
    plan.forEach((day, id) => dayOf.set(id, day));
  }

  // Send today's posts best-rated first so the spacing offsets favour them
  const ordered = [...(posts as QueueRow[])].sort(
    (a, b) =>
      (dayOf.get(a.id) ?? 0) - (dayOf.get(b.id) ?? 0) ||
      (b.review_score ?? -1) - (a.review_score ?? -1) ||
      a.scheduled_for.localeCompare(b.scheduled_for)
  );

  let sent = 0;
  let deferred = 0;
  let failed = 0;
  const deferredByDay: Record<string, number> = {};
  const errors: { id: string; platform: string; error: string }[] = [];
  const sentThisRun: Record<string, number> = {};

  for (const post of ordered) {
    const day = dayOf.get(post.id) ?? 0;

    if (day === 0) {
      // ── Send to Buffer now ────────────────────────────────────────────────
      const profile = profiles.find((p) => p.service === post.platform);
      if (!profile) {
        failed++;
        errors.push({ id: post.id, platform: post.platform, error: `No Buffer profile for '${post.platform}'` });
        continue;
      }

      // Atomic claim
      const { data: claimed } = await supabase
        .from("social_queue")
        .update({ status: "sending" })
        .eq("id", post.id)
        .eq("status", "pending_approval")
        .is("buffer_post_id", null)
        .select("id");

      if (!claimed || claimed.length === 0) continue;

      const requestedAt = mode === "now" ? now : new Date(post.scheduled_for);
      const baseAt = requestedAt <= now ? new Date(now.getTime() + 2 * 60 * 1000) : requestedAt;
      // Space posts on one platform out so they don't all land in the same minute
      const nth = sentThisRun[post.platform] ?? 0;
      sentThisRun[post.platform] = nth + 1;
      const scheduledAt = new Date(baseAt.getTime() + nth * (POST_SPACING_MINUTES[post.platform] ?? 90) * 60 * 1000);

      const tags = post.hashtags ?? [];
      const finalText = tags.length
        ? `${post.content}\n\n${tags.map((t: string) => `#${t}`).join(" ")}`
        : post.content;

      try {
        const bufferPostId = await scheduleBufferPost(
          profile.id,
          finalText,
          scheduledAt,
          post.image_url ?? undefined,
          post.platform
        );
        await supabase
          .from("social_queue")
          .update({ status: "sent", buffer_post_id: bufferPostId, sent_at: now.toISOString() })
          .eq("id", post.id);
        sent++;
      } catch (err) {
        const message = (err as Error).message;
        await supabase
          .from("social_queue")
          .update({ status: "failed", error: message })
          .eq("id", post.id);
        failed++;
        errors.push({ id: post.id, platform: post.platform, error: message });
      }
    } else {
      // ── Defer to a future day ─────────────────────────────────────────────
      // Keep the same time-of-day slot, just bump the date forward
      const original = new Date(post.scheduled_for);
      const futureDate = new Date(todayStart.getTime() + day * 24 * 60 * 60 * 1000);
      futureDate.setUTCHours(original.getUTCHours(), original.getUTCMinutes(), 0, 0);

      await supabase
        .from("social_queue")
        .update({ scheduled_for: futureDate.toISOString(), status: "pending" })
        .eq("id", post.id)
        .eq("status", "pending_approval");

      const dayLabel = futureDate.toISOString().split("T")[0];
      deferredByDay[dayLabel] = (deferredByDay[dayLabel] ?? 0) + 1;
      deferred++;
    }
  }

  return NextResponse.json({
    total: posts.length,
    sent,
    deferred,
    failed,
    deferredByDay,
    errors,
  });
}
