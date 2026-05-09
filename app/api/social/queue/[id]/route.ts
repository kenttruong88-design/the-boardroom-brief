import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";
import {
  getBufferProfiles,
  scheduleBufferPost,
  cancelBufferPost,
} from "@/app/lib/social/buffer-client";

interface PatchBody {
  content?: string;
  scheduled_for?: string;
  status?: string;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await req.json()) as PatchBody;

  const supabase = createAdminClient();

  // Fetch current row to access platform, buffer_post_id, image_url, content
  const { data: current, error: fetchErr } = await supabase
    .from("social_queue")
    .select("id, platform, buffer_post_id, image_url, content, scheduled_for")
    .eq("id", id)
    .single();

  if (fetchErr || !current) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.content !== undefined) updates.content = body.content;
  if (body.scheduled_for !== undefined) updates.scheduled_for = body.scheduled_for;
  if (body.status !== undefined) updates.status = body.status;

  const bufferId = current.buffer_post_id as string | null;
  const isCancelling = body.status === "cancelled";
  const isRescheduling = body.scheduled_for !== undefined && !isCancelling;

  // Cancel old Buffer post when cancelling or rescheduling
  if (bufferId && (isCancelling || isRescheduling)) {
    try {
      await cancelBufferPost(bufferId);
    } catch {
      // Non-fatal — post may already be sent or deleted in Buffer
    }
    updates.buffer_post_id = null;
  }

  // Schedule new Buffer post when rescheduling
  if (isRescheduling && bufferId) {
    try {
      const profiles = await getBufferProfiles();
      const profile = profiles.find((p) => p.service === current.platform);
      if (profile) {
        const newBufferId = await scheduleBufferPost(
          profile.id,
          (body.content ?? current.content) as string,
          new Date(body.scheduled_for!),
          (current.image_url as string | null) ?? undefined
        );
        updates.buffer_post_id = newBufferId;
      }
    } catch {
      // Non-fatal — queue row is updated, Buffer scheduling is best-effort
    }
  }

  const { data, error } = await supabase
    .from("social_queue")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post: data });
}
