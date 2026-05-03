import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { sendReplyNotification } from "@/app/lib/comment-notifications";

// POST /api/comments/moderate
// Body: { action: "approve"|"reject"|"delete"|"ban_user", commentId: string, reason?: string }

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as {
    action?: string;
    commentId?: string;
    reason?: string;
  };

  const { action, commentId, reason } = body;

  if (!commentId) return NextResponse.json({ error: "commentId required" }, { status: 400 });
  if (!["approve", "reject", "delete", "ban_user"].includes(action ?? "")) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (action === "approve") {
    const { data: comment, error: fetchErr } = await supabase
      .from("comments")
      .select("parent_id, article_id")
      .eq("id", commentId)
      .single();
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    const { error } = await supabase
      .from("comments")
      .update({ status: "approved" })
      .eq("id", commentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify parent author if this is a reply
    if (comment?.parent_id) {
      sendReplyNotification({
        replyId: commentId,
        parentId: comment.parent_id,
        articleId: comment.article_id,
      }).catch(() => {});
    }
    return NextResponse.json({ success: true });
  }

  if (action === "reject") {
    const { error } = await supabase
      .from("comments")
      .update({ status: "rejected" })
      .eq("id", commentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const { error } = await supabase
      .from("comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", commentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "ban_user") {
    // Fetch ip_hash + email for the comment
    const { data: comment, error: fetchError } = await supabase
      .from("comments")
      .select("ip_hash, author_email")
      .eq("id", commentId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Soft-delete the comment
    await supabase
      .from("comments")
      .update({ deleted_at: new Date().toISOString(), status: "rejected" })
      .eq("id", commentId);

    // Insert ban record
    const { error: banError } = await supabase.from("comment_bans").insert({
      ip_hash: comment.ip_hash ?? null,
      email: comment.author_email,
      reason: reason ?? "Banned via editorial dashboard",
      banned_by: auth.userId,
    });

    if (banError) return NextResponse.json({ error: banError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
