import { NextResponse } from "next/server";
import { sendReplyNotification } from "@/app/lib/comment-notifications";

// POST /api/comments/notify
// Body: { replyId, parentId, articleId, pillarSlug? }
// Called server-side after a reply is approved.
// Protected by CRON_SECRET to prevent abuse.

export async function POST(req: Request) {
  const secret = req.headers.get("x-notify-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    replyId?: string;
    parentId?: string;
    articleId?: string;
    pillarSlug?: string;
  };

  if (!body.replyId || !body.parentId || !body.articleId) {
    return NextResponse.json({ error: "replyId, parentId, articleId required" }, { status: 400 });
  }

  await sendReplyNotification({
    replyId: body.replyId,
    parentId: body.parentId,
    articleId: body.articleId,
    pillarSlug: body.pillarSlug,
  });

  return NextResponse.json({ ok: true });
}
