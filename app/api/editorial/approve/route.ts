import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { createSanityArticle } from "@/app/lib/sanity-write";
import type { SanityPublishResult } from "@/app/lib/sanity-write";
import { consumeApprovalToken } from "@/app/lib/approval-tokens";
import { requireAuth, loadDigest, saveDigest, resolveIndex, todayDate } from "../_helpers";
import { generateSocialPost } from "@/app/lib/social/content-generator";
import type { ArticleDraft } from "@/app/lib/agents/types";
import type { SanityArticle } from "@/app/lib/queries";

// Accepts: POST with body, or GET with ?id=&token= (one-click from email)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const articleId = url.searchParams.get("id") ?? "";
  const token = url.searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.redirect(new URL("/dashboard/editorial", url.origin));
  }

  const valid = await consumeApprovalToken(token);
  if (!valid) {
    return new NextResponse(
      oneClickPage("Token expired or already used", "This approval link has already been used or has expired. Open the dashboard to approve manually.", url.origin, false),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const result = await approveArticle(valid.articleId, valid.digestDate);
  if ("error" in result) {
    return new NextResponse(
      oneClickPage("Approval failed", result.error, url.origin, false),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  return new NextResponse(
    oneClickPage("Published", `Article published successfully. <a href="${result.publishedUrl}" style="color:#c8391a">View live article →</a>`, url.origin, true),
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function POST(req: Request) {
  // Check session first; fall back to token in body
  const auth = await requireAuth();
  const isAuthed = !(auth instanceof NextResponse);

  const body = await req.json() as { articleId: string; digestDate?: string; token?: string };

  let articleId = body.articleId;
  let digestDate = body.digestDate ?? todayDate();

  if (!isAuthed) {
    if (!body.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const valid = await consumeApprovalToken(body.token);
    if (!valid) return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    articleId = valid.articleId;
    digestDate = valid.digestDate;
  }

  const result = await approveArticle(articleId, digestDate);
  if ("error" in result) {
    return NextResponse.json(result, { status: result.status ?? 500 });
  }
  return NextResponse.json({ success: true, ...result });
}

// ── Social post queuing ───────────────────────────────────────────────────────

const PILLAR_NAMES: Record<string, string> = {
  "markets-floor":  "Markets Floor",
  "macro-mondays":  "Macro Mondays",
  "c-suite-circus": "C-Suite Circus",
  "global-office":  "Global Office",
  "water-cooler":   "Water Cooler",
};

const SOCIAL_SLOTS = {
  linkedin: [{ h: 8, m: 30 }, { h: 17, m: 0 }],
  twitter:  [{ h: 9, m: 0 },  { h: 13, m: 0 }, { h: 17, m: 30 }],
} as const;

function nextSlot(platform: "linkedin" | "twitter", now: Date): Date {
  for (const { h, m } of SOCIAL_SLOTS[platform]) {
    const candidate = new Date(now);
    candidate.setUTCHours(h, m, 0, 0);
    if (candidate > now) return candidate;
  }
  // Nothing left today — roll to tomorrow's first slot
  const first = SOCIAL_SLOTS[platform][0];
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(first.h, first.m, 0, 0);
  return tomorrow;
}

async function queueSocialPosts(
  draft: ArticleDraft,
  publishResult: SanityPublishResult
): Promise<void> {
  const now = new Date();
  const pillarSlug = draft.pillar;

  const article: SanityArticle = {
    _id:               publishResult.sanityDocId,
    title:             draft.headline,
    slug:              { current: publishResult.slug },
    satiricalHeadline: draft.satiricalHeadline,
    excerpt:           draft.body.split("\n\n")[0].slice(0, 300),
    publishedAt:       now.toISOString(),
    heroImageUrl:      draft.featuredImage?.heroUrl,
    pillar: {
      name: PILLAR_NAMES[pillarSlug] ?? pillarSlug,
      slug: { current: pillarSlug },
    },
    countries: draft.countries.map((c) => ({
      name: c,
      slug: { current: c.toLowerCase().replace(/\s+/g, "-") },
    })),
  };

  const [li, tw] = await Promise.all([
    generateSocialPost(article, "linkedin"),
    generateSocialPost(article, "twitter"),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const articleUrl = `${siteUrl}/${pillarSlug}/${publishResult.slug}`;
  const supabase = createAdminClient();

  await Promise.all([
    supabase.from("social_queue").insert({
      article_id:       publishResult.sanityDocId,
      article_slug:     publishResult.slug,
      article_headline: draft.headline,
      platform:         "linkedin",
      content:          li.content,
      hashtags:         li.hashtags,
      image_url:        li.imageUrl,
      article_url:      articleUrl,
      scheduled_for:    nextSlot("linkedin", now).toISOString(),
      pillar:           pillarSlug,
      status:           "pending",
      generated_by:     "auto",
    }),
    supabase.from("social_queue").insert({
      article_id:       publishResult.sanityDocId,
      article_slug:     publishResult.slug,
      article_headline: draft.headline,
      platform:         "twitter",
      content:          tw.content,
      hashtags:         tw.hashtags,
      image_url:        tw.imageUrl,
      article_url:      articleUrl,
      scheduled_for:    nextSlot("twitter", now).toISOString(),
      pillar:           pillarSlug,
      status:           "pending",
      generated_by:     "auto",
    }),
  ]);
}

// ── Shared approval logic ─────────────────────────────────────────────────────

async function approveArticle(
  articleId: string,
  date: string
): Promise<{ error: string; status?: number } | { sanityDocId: string; publishedUrl: string }> {
  const index = resolveIndex(articleId);
  if (index < 0) return { error: "Invalid articleId", status: 400 };

  const row = await loadDigest(date);
  if (!row) return { error: "No digest for that date", status: 404 };

  const entry = row.digest_json.articles[index] as typeof row.digest_json.articles[0] & {
    approved?: boolean;
    sanityDocId?: string;
  };
  if (!entry) return { error: "Article not found", status: 404 };
  if (entry.approved) return { error: "Already approved", status: 409 };

  let publishResult;
  try {
    publishResult = await createSanityArticle(entry.draft, "published");
  } catch (err) {
    return { error: (err as Error).message, status: 500 };
  }

  // Queue social posts after response — non-fatal if it fails
  after(() => queueSocialPosts(entry.draft, publishResult).catch(() => {}));

  const digest = row.digest_json;
  (digest.articles[index] as typeof entry).approved = true;
  (digest.articles[index] as typeof entry).sanityDocId = publishResult.sanityDocId;
  await saveDigest(digest, date);

  const supabase = createAdminClient();
  await supabase
    .from("daily_digest")
    .update({ articles_approved: (row.articles_approved ?? 0) + 1 })
    .eq("date", date);

  return { sanityDocId: publishResult.sanityDocId, publishedUrl: publishResult.publishedUrl };
}

// ── Minimal HTML confirmation page for one-click GET approvals ────────────────

function oneClickPage(title: string, message: string, origin: string, success: boolean) {
  const color = success ? "#15803d" : "#c8391a";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — The Alignment Times</title>
<style>body{font-family:Georgia,serif;background:#f5f0e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{max-width:480px;padding:48px 40px;background:#fff;border-top:4px solid ${color};text-align:center}
h1{color:#0f1923;font-size:1.75rem;margin:0 0 12px}p{color:#555;line-height:1.7;margin:0 0 24px}
a.btn{display:inline-block;background:#0f1923;color:#fff;text-decoration:none;padding:12px 24px;font-family:Arial,sans-serif;font-size:13px}
</style></head><body><div class="card">
<h1>${title}</h1><p>${message}</p>
<a class="btn" href="${origin}/dashboard/editorial">Open dashboard →</a>
</div></body></html>`;
}
