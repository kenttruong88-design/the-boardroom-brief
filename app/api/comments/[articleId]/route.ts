import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { moderateComment } from "@/app/lib/comment-moderator";
import { sendReplyNotification } from "@/app/lib/comment-notifications";
import { createHash } from "crypto";

export const maxDuration = 30;

// ── types ──────────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  articleId: string;
  parentId: string | null;
  authorName: string;
  body: string;
  likeCount: number;
  createdAt: string;
  replies?: Comment[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + (process.env.CRON_SECRET ?? "salt")).digest("hex").slice(0, 16);
}

function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ── GET /api/comments/[articleId] ─────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("comments")
    .select("id, article_id, parent_id, author_name, body, like_count, created_at")
    .eq("article_id", articleId)
    .eq("status", "approved")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Nest replies under their parents
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  for (const row of data ?? []) {
    const c: Comment = {
      id: row.id,
      articleId: row.article_id,
      parentId: row.parent_id ?? null,
      authorName: row.author_name,
      body: row.body,
      likeCount: row.like_count,
      createdAt: row.created_at,
      replies: [],
    };
    map.set(c.id, c);
  }

  for (const c of map.values()) {
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.replies!.push(c);
    } else {
      roots.push(c);
    }
  }

  return NextResponse.json({ comments: roots });
}

// ── POST /api/comments/[articleId] ────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await params;
  const supabase = createAdminClient();

  const body = await req.json() as {
    authorName?: string;
    authorEmail?: string;
    body?: string;
    parentId?: string;
    articleTitle?: string;
  };

  const { authorName, authorEmail, body: text, parentId, articleTitle } = body;

  // ── validation ──────────────────────────────────────────────────────────────
  if (!authorName || authorName.length < 1 || authorName.length > 60)
    return NextResponse.json({ error: "Name must be 1–60 characters." }, { status: 400 });
  if (!authorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail))
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  if (!text || text.length < 1 || text.length > 2000)
    return NextResponse.json({ error: "Comment must be 1–2000 characters." }, { status: 400 });

  const ip = getIp(req);
  const ipHash = hashIp(ip);

  // ── ban check ───────────────────────────────────────────────────────────────
  const { data: ban } = await supabase
    .from("comment_bans")
    .select("id, expires_at")
    .or(`ip_hash.eq.${ipHash},email.eq.${authorEmail}`)
    .limit(1)
    .maybeSingle();

  if (ban && (!ban.expires_at || new Date(ban.expires_at) > new Date())) {
    return NextResponse.json({ error: "You are not permitted to comment." }, { status: 403 });
  }

  // ── rate limit: 3 comments per IP per 10 minutes ───────────────────────────
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", tenMinutesAgo);

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: "Too many comments. Please wait a few minutes." },
      { status: 429 }
    );
  }

  // ── moderation ──────────────────────────────────────────────────────────────
  let modResult = { approved: false, spamScore: 0, toxicityScore: 0, relevanceScore: 5, reason: "" };
  try {
    modResult = await moderateComment(text, articleTitle ?? articleId);
  } catch (err) {
    // If moderation fails, hold for manual review
    console.error("[comments] Moderation error:", (err as Error).message);
  }

  const status = modResult.approved ? "approved" : "pending";

  // ── insert ──────────────────────────────────────────────────────────────────
  const { data: inserted, error: insertError } = await supabase
    .from("comments")
    .insert({
      article_id: articleId,
      parent_id: parentId ?? null,
      author_name: authorName,
      author_email: authorEmail,
      body: text,
      status,
      mod_spam: modResult.spamScore,
      mod_toxicity: modResult.toxicityScore,
      mod_relevance: modResult.relevanceScore,
      mod_reason: modResult.reason || null,
      ip_hash: ipHash,
    })
    .select("id, status")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Fire reply notification — non-blocking, no await
  if (inserted.status === "approved" && parentId) {
    sendReplyNotification({
      replyId: inserted.id,
      parentId,
      articleId,
    }).catch(() => {});
  }

  return NextResponse.json({
    id: inserted.id,
    status: inserted.status,
    message:
      inserted.status === "approved"
        ? "Comment posted."
        : "Your comment is awaiting moderation.",
  }, { status: 201 });
}
