import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";
import { getBufferProfiles, scheduleBufferPost } from "@/app/lib/social/buffer-client";

export const maxDuration = 120;

const DAILY_CAP = 10;

interface QueueRow {
  id: string;
  platform: string;
  content: string;
  hashtags: string[] | null;
  image_url: string | null;
  scheduled_for: string;
  status: string;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as { mode?: "scheduled" | "now" };
  const mode = body.mode ?? "scheduled";

  const supabase = createAdminClient();

  // Fetch all pending_approval posts oldest-first so earlier slots get today's capacity
  const { data: posts, error: fetchErr } = await supabase
    .from("social_queue")
    .select("id, platform, content, hashtags, image_url, scheduled_for, status")
    .eq("status", "pending_approval")
    .is("buffer_post_id", null)
    .order("scheduled_for", { ascending: true });

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!posts || posts.length === 0) {
    return NextResponse.json({ sent: 0, deferred: 0, failed: 0, message: "No posts awaiting approval" });
  }

  // Count today's already-committed posts (sent + pending + sending scheduled for today)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const { count: todayCommitted } = await supabase
    .from("social_queue")
    .select("*", { count: "exact", head: true })
    .in("status", ["sent", "sending", "pending"])
    .gte("scheduled_for", todayStart.toISOString())
    .lt("scheduled_for", todayEnd.toISOString());

  // Load Buffer profiles once (only needed for posts sent now)
  let profiles: Awaited<ReturnType<typeof getBufferProfiles>> = [];
  try {
    profiles = await getBufferProfiles();
  } catch (err) {
    return NextResponse.json({ error: `Buffer unavailable: ${(err as Error).message}` }, { status: 502 });
  }

  const now = new Date();

  // Day-bucket state
  // dayBucket=0 means today, dayBucket=1 means tomorrow, etc.
  let dayBucket = 0;
  let slotsInBucket = Math.max(0, DAILY_CAP - (todayCommitted ?? 0));

  // If today is already full, start filling tomorrow
  if (slotsInBucket === 0) {
    dayBucket = 1;
    slotsInBucket = DAILY_CAP;
  }

  let sent = 0;
  let deferred = 0;
  let failed = 0;
  const deferredByDay: Record<string, number> = {};
  const errors: { id: string; platform: string; error: string }[] = [];

  for (const post of posts as QueueRow[]) {
    // Advance to next bucket when current one is full
    if (slotsInBucket <= 0) {
      dayBucket++;
      slotsInBucket = DAILY_CAP;
    }

    if (dayBucket === 0) {
      // ── Send to Buffer now ────────────────────────────────────────────────
      const profile = profiles.find((p) => p.service === post.platform);
      if (!profile) {
        failed++;
        errors.push({ id: post.id, platform: post.platform, error: `No Buffer profile for '${post.platform}'` });
        slotsInBucket--;
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

      if (!claimed || claimed.length === 0) { slotsInBucket--; continue; }

      const requestedAt = mode === "now" ? now : new Date(post.scheduled_for);
      const scheduledAt = requestedAt <= now ? new Date(now.getTime() + 2 * 60 * 1000) : requestedAt;

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
      const futureDate = new Date(todayStart.getTime() + dayBucket * 24 * 60 * 60 * 1000);
      futureDate.setUTCHours(original.getUTCHours(), original.getUTCMinutes(), 0, 0);

      await supabase
        .from("social_queue")
        .update({ scheduled_for: futureDate.toISOString(), status: "pending" })
        .eq("id", post.id);

      const dayLabel = futureDate.toISOString().split("T")[0];
      deferredByDay[dayLabel] = (deferredByDay[dayLabel] ?? 0) + 1;
      deferred++;
    }

    slotsInBucket--;
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
