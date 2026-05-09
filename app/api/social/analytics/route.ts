import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { getBufferPostAnalytics } from "@/app/lib/social/buffer-client";

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

interface QueueRow {
  id: string;
  platform: string;
  buffer_post_id: string;
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
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Fetch eligible posts
  const { data, error } = await supabase
    .from("social_queue")
    .select("id, platform, buffer_post_id")
    .eq("status", "sent")
    .lt("sent_at", cutoff)
    .is("analytics_fetched_at", null)
    .not("buffer_post_id", "is", null)
    .order("sent_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const posts = (data ?? []) as QueueRow[];

  if (posts.length === 0) {
    return NextResponse.json({ analyticsCollected: 0 });
  }

  // 2. Collect analytics for each post
  let analyticsCollected = 0;
  const now = new Date().toISOString();

  for (const post of posts) {
    try {
      // a. Fetch from Buffer
      const analytics = await getBufferPostAnalytics(post.buffer_post_id);

      // b. Update social_queue
      await supabase
        .from("social_queue")
        .update({
          impressions:          analytics.impressions,
          likes:                analytics.likes,
          comments:             analytics.comments,
          shares:               analytics.shares,
          clicks:               analytics.clicks,
          analytics_fetched_at: now,
        })
        .eq("id", post.id);

      // c. Insert into social_analytics_log
      await supabase.from("social_analytics_log").insert({
        queue_id:        post.id,
        platform:        post.platform,
        fetched_at:      now,
        impressions:     analytics.impressions,
        likes:           analytics.likes,
        comments:        analytics.comments,
        shares:          analytics.shares,
        clicks:          analytics.clicks,
        engagement_rate:
          analytics.impressions > 0
            ? ((analytics.likes + analytics.comments + analytics.shares) /
                analytics.impressions) *
              100
            : 0,
      });

      analyticsCollected++;
    } catch {
      // Non-fatal — leave analytics_fetched_at null so the next run retries
    }

    await sleep(500);
  }

  // 3. Return summary
  return NextResponse.json({ analyticsCollected });
}
