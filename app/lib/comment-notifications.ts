import { Resend } from "resend";
import { render } from "@react-email/components";
import { createAdminClient } from "./supabase-server";
import CommentReply from "@/emails/comment-reply";

// Lazy — instantiated only when a notification is actually sent
function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  return new Resend(process.env.RESEND_API_KEY);
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://theboardroombrief.com";
const FROM = process.env.RESEND_FROM ?? "The Boardroom Brief <noreply@theboardroombrief.com>";

interface ReplyContext {
  /** The new reply comment's DB id */
  replyId: string;
  /** parent_id of the reply */
  parentId: string;
  /** article_id (slug) */
  articleId: string;
  /** Pillar slug — needed to build the article URL */
  pillarSlug?: string;
}

/**
 * Sends a reply-notification email to the parent comment's author.
 * Silent no-op on any error — never blocks the comment submission flow.
 */
export async function sendReplyNotification(ctx: ReplyContext): Promise<void> {
  try {
    const supabase = createAdminClient();

    // Fetch both parent and reply comments in parallel
    const [{ data: parent }, { data: reply }] = await Promise.all([
      supabase
        .from("comments")
        .select("author_name, author_email, body")
        .eq("id", ctx.parentId)
        .single(),
      supabase
        .from("comments")
        .select("author_name, author_email, body")
        .eq("id", ctx.replyId)
        .single(),
    ]);

    if (!parent || !reply) return;

    // Don't notify on self-replies
    if (parent.author_email === reply.author_email) return;

    // Check notification preference via profiles table (looked up by email)
    const { data: profile } = await supabase
      .from("profiles")
      .select("notify_on_replies")
      .eq("email", parent.author_email)
      .maybeSingle();

    // If user has a profile and has opted out, skip
    if (profile && profile.notify_on_replies === false) return;

    // Build article URL
    const articleUrl = ctx.pillarSlug
      ? `${SITE_URL}/${ctx.pillarSlug}/${ctx.articleId}`
      : `${SITE_URL}/articles/${ctx.articleId}`;

    // Resolve article title from Sanity (best-effort)
    let articleTitle = ctx.articleId; // fallback to slug
    try {
      const { getArticleBySlug } = await import("./queries");
      const article = await getArticleBySlug(ctx.articleId);
      if (article?.title) articleTitle = article.title;
    } catch {
      // ignore
    }

    const html = await render(
      CommentReply({
        parentAuthorName: parent.author_name,
        parentBody: parent.body,
        replyAuthorName: reply.author_name,
        replyBody: reply.body,
        articleTitle,
        articleUrl,
        commentId: ctx.replyId,
      })
    );

    await getResend().emails.send({
      from: FROM,
      to: parent.author_email,
      subject: `${reply.author_name} replied to your comment on The Boardroom Brief`,
      html,
    });
  } catch (err) {
    // Log but never throw — notifications are non-critical
    console.error("[comment-notifications] Failed to send reply notification:", (err as Error).message);
  }
}
