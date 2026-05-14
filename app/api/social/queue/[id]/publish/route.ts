import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";
import { getBufferProfiles, scheduleBufferPost } from "@/app/lib/social/buffer-client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json() as { mode?: "scheduled" | "now" };
  const mode = body.mode ?? "scheduled";

  const supabase = createAdminClient();

  const { data: post, error: fetchErr } = await supabase
    .from("social_queue")
    .select("id, platform, content, image_url, scheduled_for, status")
    .eq("id", id)
    .single();

  if (fetchErr || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const profiles = await getBufferProfiles();
  const profile = profiles.find((p) => p.service === (post.platform as string));
  if (!profile) {
    return NextResponse.json(
      { error: `No Buffer profile found for platform '${post.platform}'` },
      { status: 400 }
    );
  }

  const scheduledAt = mode === "now" ? new Date() : new Date(post.scheduled_for as string);

  const bufferPostId = await scheduleBufferPost(
    profile.id,
    post.content as string,
    scheduledAt,
    (post.image_url as string | null) ?? undefined,
    post.platform as string
  );

  const { data: updated, error: updateErr } = await supabase
    .from("social_queue")
    .update({
      status: "sent",
      buffer_post_id: bufferPostId,
      sent_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ post: updated });
}
