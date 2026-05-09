import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const scheduledFor = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("social_queue")
    .update({
      status:           "pending",
      scheduled_for:    scheduledFor,
      error:            null,
      buffer_post_id:   null,
    })
    .eq("id", id)
    .eq("status", "failed")
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Post not found or not in failed state" },
      { status: 404 }
    );
  }

  return NextResponse.json({ post: data, scheduledFor });
}
