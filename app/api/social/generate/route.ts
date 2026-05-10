import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { getArticlesPublishedToday } from "@/app/lib/queries";
import { buildDaySchedule, checkDuplicates } from "@/app/lib/social/schedule-builder";
import { generateSocialPost } from "@/app/lib/social/content-generator";
import { client as sanityClient } from "@/app/lib/sanity";

export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");
  return (
    auth === `Bearer ${process.env.CRON_SECRET}` ||
    cronHeader === process.env.CRON_SECRET
  );
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return run();
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return run();
}

async function run() {
  const startedAt = Date.now();

  if (!sanityClient) {
    return NextResponse.json({ skipped: true, reason: "Sanity not configured" });
  }

  const supabase = createAdminClient();
  const today = new Date();
  const errors: { articleId: string; platform: string; error: string }[] = [];

  // 1. Fetch today's published articles
  const articles = await getArticlesPublishedToday();

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
    return NextResponse.json({
      message: "No articles published today, skipping social generation",
    });
  }

  // 2. Build schedule
  const scheduled = buildDaySchedule(articles, today);

  // 3. Filter already-queued posts
  const newPosts = await checkDuplicates(scheduled);

  // 4. Generate content and insert into queue
  let postsGenerated = 0;
  const schedule: {
    platform: string;
    headline: string;
    scheduledFor: string;
    slot: string;
  }[] = [];

  for (const { article, platform, scheduledFor, slot } of newPosts) {
    try {
      const socialPost = await generateSocialPost(article, platform);

      await supabase.from("social_queue").insert({
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
        status:           "pending_approval",
        generated_by:     "auto",
      });

      postsGenerated++;
      schedule.push({ platform, headline: article.title, scheduledFor: scheduledFor.toISOString(), slot });
    } catch (err) {
      errors.push({
        articleId: article._id,
        platform,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await sleep(500);
  }

  // 5. Log run
  await supabase.from("social_runs").insert({
    trigger:         "cron",
    articles_found:  articles.length,
    posts_generated: postsGenerated,
    posts_queued:    postsGenerated,
    posts_sent:      0,
    errors,
    duration_ms:     Date.now() - startedAt,
  });

  // 6. Return summary
  return NextResponse.json({ articlesFound: articles.length, postsGenerated, schedule });
}
