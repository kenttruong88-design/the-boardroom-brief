import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";
import { getArticleBySlug } from "@/app/lib/queries";

export const maxDuration = 30;

export interface AdminComment {
  id: string;
  articleId: string;
  articleTitle: string | null;
  articlePillarSlug: string | null;
  parentId: string | null;
  authorName: string;
  authorEmail: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  modSpam: number | null;
  modToxicity: number | null;
  modRelevance: number | null;
  modReason: string | null;
  overallScore: number | null;
  likeCount: number;
  createdAt: string;
}

export interface CommentStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  banned: number;
}

function computeOverall(
  spam: number | null,
  toxicity: number | null,
  relevance: number | null
): number | null {
  if (spam === null || toxicity === null || relevance === null) return null;
  // Weighted: relevance 40%, non-spam 30%, non-toxic 30%
  return Math.round(((relevance * 0.4 + (10 - spam) * 0.3 + (10 - toxicity) * 0.3) * 10)) / 10;
}

// GET /api/admin/comments
// Query: status, page, articleId, dateRange
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") ?? "pending";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const articleId = searchParams.get("articleId") ?? "";
  const dateRange = searchParams.get("dateRange") ?? "all";
  const limit = 25;
  const offset = (page - 1) * limit;

  const supabase = createAdminClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // ── Build comment query ─────────────────────────────────────────────────────
  let query = supabase
    .from("comments")
    .select(
      "id, article_id, parent_id, author_name, author_email, body, status, mod_spam, mod_toxicity, mod_relevance, mod_reason, like_count, created_at",
      { count: "exact" }
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (statusParam === "spam") {
    query = query.gte("mod_spam", 7);
  } else if (statusParam !== "all") {
    query = query.eq("status", statusParam);
  }

  if (articleId) query = query.eq("article_id", articleId);

  if (dateRange === "today") query = query.gte("created_at", todayStart.toISOString());
  else if (dateRange === "7days") query = query.gte("created_at", sevenDaysAgo.toISOString());

  const { data: rows, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Resolve article titles from Sanity ──────────────────────────────────────
  type RowType = {
    id: string;
    article_id: string;
    parent_id: string | null;
    author_name: string;
    author_email: string;
    body: string;
    status: string;
    mod_spam: number | null;
    mod_toxicity: number | null;
    mod_relevance: number | null;
    mod_reason: string | null;
    like_count: number;
    created_at: string;
  };

  const typedRows = (rows ?? []) as RowType[];
  const uniqueSlugs = [...new Set(typedRows.map((r) => r.article_id))];
  const articleMap: Record<string, { title: string; pillarSlug: string }> = {};
  await Promise.allSettled(
    uniqueSlugs.map(async (slug) => {
      try {
        const article = await getArticleBySlug(slug);
        if (article) {
          articleMap[slug] = {
            title: article.title,
            pillarSlug: article.pillar?.slug?.current ?? "",
          };
        }
      } catch {
        // ignore — show slug as fallback
      }
    })
  );

  const comments: AdminComment[] = typedRows.map((r) => ({
    id: r.id,
    articleId: r.article_id,
    articleTitle: articleMap[r.article_id]?.title ?? null,
    articlePillarSlug: articleMap[r.article_id]?.pillarSlug ?? null,
    parentId: r.parent_id ?? null,
    authorName: r.author_name,
    authorEmail: r.author_email,
    body: r.body,
    status: r.status as AdminComment["status"],
    modSpam: r.mod_spam ?? null,
    modToxicity: r.mod_toxicity ?? null,
    modRelevance: r.mod_relevance ?? null,
    modReason: r.mod_reason ?? null,
    overallScore: computeOverall(r.mod_spam, r.mod_toxicity, r.mod_relevance),
    likeCount: r.like_count ?? 0,
    createdAt: r.created_at,
  }));

  // ── Stats ───────────────────────────────────────────────────────────────────
  const [
    { count: pendingCount },
    { count: approvedTodayCount },
    { count: rejectedTodayCount },
    { count: bannedCount },
  ] = await Promise.all([
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("status", "approved").gte("created_at", todayStart.toISOString()),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("status", "rejected").gte("created_at", todayStart.toISOString()),
    supabase.from("comment_bans").select("id", { count: "exact", head: true }),
  ]);

  // ── Distinct article IDs (for filter dropdown) ──────────────────────────────
  const { data: articleRows } = await supabase
    .from("comments")
    .select("article_id")
    .is("deleted_at", null);

  const distinctArticles = [
    ...new Map(
      ((articleRows ?? []) as { article_id: string }[]).map((r) => {
        const slug = r.article_id;
        return [slug, { slug, title: articleMap[slug]?.title ?? slug }] as const;
      })
    ).values(),
  ];

  const stats: CommentStats = {
    pending: pendingCount ?? 0,
    approvedToday: approvedTodayCount ?? 0,
    rejectedToday: rejectedTodayCount ?? 0,
    banned: bannedCount ?? 0,
  };

  return NextResponse.json({ comments, total: count ?? 0, stats, articles: distinctArticles });
}
