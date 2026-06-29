import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";
import { client as sanityClient } from "@/app/lib/sanity";

export const maxDuration = 30;

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStr = now.toISOString().split("T")[0];
  const todayISO = todayStart.toISOString();

  const [
    sanityArticles,
    oooArticles,
    goArticles,
    socialRows,
    newsletterSend,
    subscriberCountRow,
    newSubscribersRow,
    commentsToday,
    pendingComments,
    intelRun,
  ] = await Promise.all([

    // ── 1. All articles published today from Sanity ───────────────────────────
    sanityClient?.fetch<{ title: string; pillar: string; publishedAt: string; slug: string }[]>(
      `*[_type == "article" && publishedAt >= $since] | order(publishedAt desc) {
        title,
        "pillar": pillar->slug.current,
        publishedAt,
        "slug": slug.current
      }`,
      { since: todayISO }
    ).catch(() => []) ?? Promise.resolve([]),

    // ── 2. Out of Office total published (article-ooo-*) ─────────────────────
    sanityClient?.fetch<{ _id: string }[]>(
      `*[_type == "article" && _id match "article-ooo-*"]{ _id }`
    ).catch(() => []) ?? Promise.resolve([]),

    // ── 3. Global Office total published (article-go-*) ──────────────────────
    sanityClient?.fetch<{ _id: string }[]>(
      `*[_type == "article" && _id match "article-go-*"]{ _id }`
    ).catch(() => []) ?? Promise.resolve([]),

    // ── 4. Social posts created today ────────────────────────────────────────
    supabase
      .from("social_queue")
      .select("platform, status, article_headline, scheduled_for, created_at")
      .gte("created_at", todayISO)
      .order("created_at", { ascending: false }),

    // ── 5. Newsletter send today ──────────────────────────────────────────────
    supabase
      .from("newsletter_sends")
      .select("status, send_date, sent_count, open_count, click_count, unsubscribe_count, subject")
      .eq("send_date", todayStr)
      .maybeSingle(),

    // ── 6. Total confirmed subscribers ───────────────────────────────────────
    supabase
      .from("subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed"),

    // ── 7. New subscribers today ──────────────────────────────────────────────
    supabase
      .from("subscribers")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayISO),

    // ── 8. Comments received today ────────────────────────────────────────────
    supabase
      .from("comments")
      .select("id, status, like_count, created_at")
      .gte("created_at", todayISO)
      .is("deleted_at", null),

    // ── 9. Pending comments (all time) ───────────────────────────────────────
    supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("deleted_at", null),

    // ── 10. News intel last run ───────────────────────────────────────────────
    supabase
      .from("news_intel_runs")
      .select("ran_at, stories_found, stories_stored, duration_ms, errors")
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // ── Articles ──────────────────────────────────────────────────────────────────
  const articles = (sanityArticles ?? []) as { title: string; pillar: string; publishedAt: string; slug: string }[];
  const byPillar: Record<string, { count: number; titles: string[] }> = {};
  for (const a of articles) {
    const p = a.pillar ?? "unknown";
    if (!byPillar[p]) byPillar[p] = { count: 0, titles: [] };
    byPillar[p].count++;
    byPillar[p].titles.push(a.title);
  }

  // ── Blog post backlogs ────────────────────────────────────────────────────────
  const OOO_TOTAL_FILES = 30; // content/out-of-office file count (approx)
  const GO_TOTAL_FILES  = 57; // content/global-office file count (approx)
  const oooPublished = (oooArticles ?? []).length;
  const goPublished  = (goArticles  ?? []).length;

  // Articles published today that are blog posts
  const oooToday = articles.filter((a) => a.pillar === "out-of-office").length;
  const goToday  = articles.filter((a) => a.pillar === "global-office").length;

  // ── Social ────────────────────────────────────────────────────────────────────
  type SocialRow = { platform: string; status: string; article_headline: string; scheduled_for: string; created_at: string };
  const socialPosts = (socialRows.data ?? []) as SocialRow[];
  const socialByPlatform: Record<string, { total: number; published: number; pending: number }> = {};
  for (const p of socialPosts) {
    if (!socialByPlatform[p.platform]) socialByPlatform[p.platform] = { total: 0, published: 0, pending: 0 };
    socialByPlatform[p.platform].total++;
    if (p.status === "published" || p.status === "sent") socialByPlatform[p.platform].published++;
    else socialByPlatform[p.platform].pending++;
  }

  // ── Newsletter ────────────────────────────────────────────────────────────────
  type SendRow = { status: string; send_date: string; sent_count: number; open_count: number; click_count: number; unsubscribe_count: number; subject?: string } | null;
  const send = (newsletterSend.data ?? null) as SendRow;
  const sentCount = send?.sent_count ?? 0;
  const openRate  = sentCount > 0 ? +((((send?.open_count ?? 0) / sentCount) * 100).toFixed(1)) : null;
  const clickRate = sentCount > 0 ? +((((send?.click_count ?? 0) / sentCount) * 100).toFixed(1)) : null;

  // ── Comments ──────────────────────────────────────────────────────────────────
  type CommentRow = { id: string; status: string; like_count: number; created_at: string };
  const commentsArr = (commentsToday.data ?? []) as CommentRow[];
  const approvedToday = commentsArr.filter((c) => c.status === "approved").length;
  const likesToday    = commentsArr.reduce((sum, c) => sum + (c.like_count ?? 0), 0);

  // ── News intel ────────────────────────────────────────────────────────────────
  type IntelRow = { ran_at: string; stories_found: number; stories_stored: number; duration_ms: number; errors: string[] } | null;
  const intel = (intelRun.data ?? null) as IntelRow;
  const ranToday = intel ? intel.ran_at.startsWith(todayStr) : false;

  return NextResponse.json({
    generatedAt: now.toISOString(),
    articles: {
      publishedToday: articles.length,
      byPillar: Object.entries(byPillar).map(([pillar, data]) => ({ pillar, ...data })),
      recent: articles.slice(0, 8).map((a) => ({ title: a.title, pillar: a.pillar, publishedAt: a.publishedAt })),
    },
    blogPosts: {
      outOfOffice: { publishedToday: oooToday, totalPublished: oooPublished, remaining: Math.max(0, OOO_TOTAL_FILES - oooPublished) },
      globalOffice: { publishedToday: goToday, totalPublished: goPublished, remaining: Math.max(0, GO_TOTAL_FILES - goPublished) },
    },
    social: {
      totalToday: socialPosts.length,
      byPlatform: Object.entries(socialByPlatform).map(([platform, data]) => ({ platform, ...data })),
      recent: socialPosts.slice(0, 6).map((p) => ({
        headline: p.article_headline,
        platform: p.platform,
        status: p.status,
        scheduledFor: p.scheduled_for,
      })),
    },
    newsletter: {
      sentToday: send?.status === "sent",
      status: send?.status ?? "not_sent",
      subject: send?.subject ?? null,
      sentCount,
      openRate,
      clickRate,
      unsubscribeCount: send?.unsubscribe_count ?? 0,
      totalSubscribers: subscriberCountRow.count ?? 0,
      newToday: newSubscribersRow.count ?? 0,
    },
    comments: {
      newToday: commentsArr.length,
      approvedToday,
      pendingModeration: pendingComments.count ?? 0,
      likesToday,
    },
    newsIntel: {
      ranToday,
      lastRunAt: intel?.ran_at ?? null,
      storiesFound: intel?.stories_found ?? 0,
      storiesStored: intel?.stories_stored ?? 0,
      durationMs: intel?.duration_ms ?? 0,
      errors: intel?.errors ?? [],
    },
  });
}
