import { NextResponse } from "next/server";
import { createAdminClient, createServerSupabaseClient } from "@/app/lib/supabase-server";
import { getArticlesPublishedToday } from "@/app/lib/queries";
import type { SanityArticle } from "@/app/lib/queries";
import { buildDaySchedule, checkDuplicates, type ScheduledPost } from "@/app/lib/social/schedule-builder";
import { generateSocialPost } from "@/app/lib/social/content-generator";
import { getBufferProfiles, scheduleBufferPost } from "@/app/lib/social/buffer-client";
import { client as sanityClient, writeClient as sanityWriteClient } from "@/app/lib/sanity";

export const maxDuration = 60;

const AUTO_POST_THRESHOLD = 7.0;

async function isAuthorized(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");

  if (
    auth === `Bearer ${process.env.CRON_SECRET}` ||
    cronHeader === process.env.CRON_SECRET
  ) {
    return true;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function GET(req: Request) {
  if (!await isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return run(req);
}

export async function POST(req: Request) {
  if (!await isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return run(req);
}

async function run(req: Request) {
  const startedAt = Date.now();

  if (!sanityClient) {
    return NextResponse.json({ skipped: true, reason: "Sanity not configured" });
  }

  const supabase = createAdminClient();
  const today = new Date();
  const errors: { articleId: string; platform: string; error: string }[] = [];

  // 1. Read auto-post setting
  let autoPostEnabled = false;
  try {
    const { data } = await supabase
      .from("social_settings")
      .select("auto_post_enabled")
      .eq("id", 1)
      .single();
    autoPostEnabled = data?.auto_post_enabled ?? false;
  } catch {
    // settings table may not exist yet — default to manual approval
  }

  // 2. If auto-post is on, pre-fetch Buffer profiles so we can publish inline
  let profileMap: Record<string, string> = {};
  if (autoPostEnabled) {
    try {
      const profiles = await getBufferProfiles();
      profileMap = Object.fromEntries(profiles.map((p) => [p.service, p.id]));
    } catch {
      // Buffer unavailable — fall back to pending_approval for all posts
      autoPostEnabled = false;
    }
  }

  // 3. Fetch articles — ?articleId=xxx overrides the 24-hour window for testing
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("articleId");

  let articles: SanityArticle[];
  if (articleId) {
    const fetchClient = sanityWriteClient ?? sanityClient;
    const article = await fetchClient.fetch<SanityArticle | null>(
      `*[_type == "article" && _id == $id][0] {
        _id, title, slug, satiricalHeadline, excerpt, heroImageUrl, publishedAt,
        pillar->{ name, slug, color },
        countries[]->{ name, slug, code }
      }`,
      { id: articleId }
    );
    articles = article ? [article] : [];
  } else {
    articles = await getArticlesPublishedToday();
  }

  if (articles.length === 0) {
    await supabase.from("social_runs").insert({
      trigger: "cron",
      articles_found: 0,
      posts_generated: 0,
      posts_queued: 0,
      posts_sent: 0,
      errors: [],
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ message: "No articles published today, skipping social generation" });
  }

  // 4. Build schedule and filter duplicates
  let scheduled: ScheduledPost[] = buildDaySchedule(articles, today);

  // Test mode fallback: when ?articleId is set and all today's slots have passed,
  // schedule one post per platform starting 5 minutes from now
  if (articleId && scheduled.length === 0 && articles.length > 0) {
    const now = Date.now();
    (["linkedin", "twitter", "instagram"] as const).forEach((platform, i) => {
      scheduled.push({
        article: articles[0],
        platform,
        scheduledFor: new Date(now + (i + 1) * 5 * 60 * 1000),
        slot: "test",
      });
    });
  }

  // Skip duplicate check in test mode so re-runs always generate fresh posts
  const newPosts = articleId ? scheduled : await checkDuplicates(scheduled);

  // 5. Generate content and insert — auto-publish if enabled and score ≥ 7
  let postsGenerated = 0;
  let postsAutoPosted = 0;
  const schedule: { platform: string; headline: string; scheduledFor: string; slot: string; autoPosted: boolean }[] = [];

  for (const { article, platform, scheduledFor, slot } of newPosts) {
    try {
      const socialPost = await generateSocialPost(article, platform);
      const score = socialPost.review?.score ?? 0;
      const qualifies = autoPostEnabled && score >= AUTO_POST_THRESHOLD;
      const profileId = profileMap[platform];

      const baseRow = {
        article_id:       article._id,
        article_slug:     article.slug.current,
        article_headline: article.title,
        platform,
        content:          socialPost.content,
        hashtags:         socialPost.hashtags,
        image_url:        socialPost.imageUrl,
        article_url:      socialPost.articleUrl,
        scheduled_for:    scheduledFor.toISOString(),
        pillar:           article.pillar?.slug?.current ?? null,
        generated_by:     "auto",
        review_score:     socialPost.review?.score  ?? null,
        review_passed:    socialPost.review?.passed ?? null,
        review_notes:     socialPost.review?.notes  ?? null,
      };

      if (qualifies && profileId) {
        // Auto-publish directly to Buffer
        try {
          const bufferPostId = await scheduleBufferPost(
            profileId,
            socialPost.content,
            scheduledFor,
            socialPost.imageUrl ?? undefined,
            platform
          );
          await supabase.from("social_queue").insert({
            ...baseRow,
            status:           "sent",
            buffer_post_id:   bufferPostId,
            sent_at:          new Date().toISOString(),
          });
          postsAutoPosted++;
          schedule.push({ platform, headline: article.title, scheduledFor: scheduledFor.toISOString(), slot, autoPosted: true });
        } catch (bufferErr) {
          // Buffer failed — save for manual approval so the post isn't lost
          await supabase.from("social_queue").insert({ ...baseRow, status: "pending_approval" });
          errors.push({
            articleId: article._id,
            platform,
            error: `Auto-post failed, queued for approval: ${bufferErr instanceof Error ? bufferErr.message : String(bufferErr)}`,
          });
          schedule.push({ platform, headline: article.title, scheduledFor: scheduledFor.toISOString(), slot, autoPosted: false });
        }
      } else {
        // Manual approval flow (score too low, auto-post off, or no Buffer profile)
        await supabase.from("social_queue").insert({ ...baseRow, status: "pending_approval" });
        schedule.push({ platform, headline: article.title, scheduledFor: scheduledFor.toISOString(), slot, autoPosted: false });
      }

      postsGenerated++;
    } catch (err) {
      errors.push({
        articleId: article._id,
        platform,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await sleep(500);
  }

  // 6. Log run
  await supabase.from("social_runs").insert({
    trigger:         "cron",
    articles_found:  articles.length,
    posts_generated: postsGenerated,
    posts_queued:    postsGenerated - postsAutoPosted,
    posts_sent:      postsAutoPosted,
    errors,
    duration_ms:     Date.now() - startedAt,
  });

  return NextResponse.json({
    articlesFound:    articles.length,
    postsGenerated,
    postsAutoPosted,
    autoPostEnabled,
    schedule,
  });
}
