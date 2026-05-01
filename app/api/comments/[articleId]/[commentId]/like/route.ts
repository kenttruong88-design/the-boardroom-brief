import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";

// POST /api/comments/[articleId]/[commentId]/like
// Body: { fingerprint: string }
// Toggles the like; returns { liked: boolean, likeCount: number }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ articleId: string; commentId: string }> }
) {
  const { commentId } = await params;
  const supabase = createAdminClient();

  const body = await req.json() as { fingerprint?: string };
  const { fingerprint } = body;

  if (!fingerprint || fingerprint.length < 4) {
    return NextResponse.json({ error: "fingerprint required" }, { status: 400 });
  }

  // Check if already liked
  const { data: existing } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  let liked: boolean;

  if (existing) {
    // Unlike
    await supabase
      .from("comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("fingerprint", fingerprint);

    await supabase.rpc("decrement_comment_likes", { comment_id: commentId });
    liked = false;
  } else {
    // Like
    await supabase
      .from("comment_likes")
      .insert({ comment_id: commentId, fingerprint });

    await supabase.rpc("increment_comment_likes", { comment_id: commentId });
    liked = true;
  }

  // Fetch updated count
  const { data: comment } = await supabase
    .from("comments")
    .select("like_count")
    .eq("id", commentId)
    .single();

  return NextResponse.json({ liked, likeCount: comment?.like_count ?? 0 });
}
