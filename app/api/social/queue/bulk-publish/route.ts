import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";
import { getBufferProfiles, scheduleBufferPost } from "@/app/lib/social/buffer-client";

export const maxDuration = 120;

interface QueueRow {
  id: string;
  platform: string;
  content: string;
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

  // Fetch all pending_approval posts
  const { data: posts, error: fetchErr } = await supabase
    .from("social_queue")
    .select("id, platform, content, image_url, scheduled_for, status")
    .eq("status", "pending_approval")
    .is("buffer_post_id", null);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!posts || posts.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, message: "No posts awaiting approval" });
  }

  // Load Buffer profiles once
  let profiles: Awaited<ReturnType<typeof getBufferProfiles>>;
  try {
    profiles = await getBufferProfiles();
  } catch (err) {
    return NextResponse.json({ error: `Buffer unavailable: ${(err as Error).message}` }, { status: 502 });
  }

  const now = new Date();
  let sent = 0;
  let failed = 0;
  const errors: { id: string; platform: string; error: string }[] = [];

  for (const post of posts as QueueRow[]) {
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
    const scheduledAt = requestedAt <= now ? new Date(now.getTime() + 2 * 60 * 1000) : requestedAt;

    try {
      const bufferPostId = await scheduleBufferPost(
        profile.id,
        post.content,
        scheduledAt,
        post.image_url ?? undefined,
        post.platform
      );

      await supabase
        .from("social_queue")
        .update({ status: "sent", buffer_post_id: bufferPostId, sent_at: new Date().toISOString() })
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
  }

  return NextResponse.json({ sent, failed, total: posts.length, errors });
}
