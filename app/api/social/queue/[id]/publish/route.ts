import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";
import { getBufferProfiles, scheduleBufferPost, cancelBufferPost } from "@/app/lib/social/buffer-client";

export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await req.json() as { mode?: "scheduled" | "now" };
    const mode = body.mode ?? "scheduled";

    const supabase = createAdminClient();

    // 1. Fetch current row
    const { data: post, error: fetchErr } = await supabase
      .from("social_queue")
      .select("id, platform, content, image_url, scheduled_for, status, buffer_post_id")
      .eq("id", id)
      .single();

    if (fetchErr || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // 2. Reject terminal or in-flight states immediately
    const status = post.status as string;
    if (status === "sent" || status === "sending" || status === "cancelled") {
      return NextResponse.json({ error: `Post is already ${status}` }, { status: 409 });
    }

    // 3. Atomic claim: transition to 'sending' only if status + no buffer_post_id match.
    // Prevents double-sends from concurrent clicks or retries.
    const { data: claimed } = await supabase
      .from("social_queue")
      .update({ status: "sending" })
      .eq("id", id)
      .in("status", ["pending_approval", "pending"])
      .is("buffer_post_id", null)
      .select("id");

    if (!claimed || claimed.length === 0) {
      return NextResponse.json(
        { error: "Post is already being processed or has been sent" },
        { status: 409 }
      );
    }

    // 4. Resolve Buffer profile — revert claim on failure
    const profiles = await getBufferProfiles();
    const profile = profiles.find((p) => p.service === (post.platform as string));
    if (!profile) {
      await supabase.from("social_queue").update({ status }).eq("id", id);
      return NextResponse.json(
        { error: `No Buffer profile found for platform '${post.platform}'` },
        { status: 400 }
      );
    }

    // 5. Resolve scheduled time — bump past slots to now+2min
    const now = new Date();
    const requestedAt = mode === "now" ? now : new Date(post.scheduled_for as string);
    const scheduledAt = requestedAt <= now ? new Date(now.getTime() + 2 * 60 * 1000) : requestedAt;

    // 6. Call Buffer — revert claim on failure so the post can be retried
    let bufferPostId: string;
    try {
      bufferPostId = await scheduleBufferPost(
        profile.id,
        post.content as string,
        scheduledAt,
        (post.image_url as string | null) ?? undefined,
        post.platform as string
      );
    } catch (bufferErr) {
      await supabase.from("social_queue").update({ status }).eq("id", id);
      throw bufferErr;
    }

    // 7. Mark sent. If the DB write fails after Buffer succeeded, cancel the Buffer post
    // to avoid an unrecorded live post, then record the buffer_post_id for reconciliation.
    const { data: updated, error: updateErr } = await supabase
      .from("social_queue")
      .update({ status: "sent", buffer_post_id: bufferPostId, sent_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      try {
        await cancelBufferPost(bufferPostId);
        await supabase.from("social_queue").update({ status }).eq("id", id);
      } catch {
        // Cancel failed — at least record the buffer_post_id so operators can reconcile
        await supabase.from("social_queue").update({
          status: "failed",
          buffer_post_id: bufferPostId,
          error: `DB update failed after Buffer post created: ${updateErr.message}`,
        }).eq("id", id);
      }
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ post: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
