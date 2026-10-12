import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import {
  getBufferProfiles,
  scheduleBufferPost,
  type BufferProfile,
} from "@/app/lib/social/buffer-client";

export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[social/publish] CRON_SECRET env var is not set");
    return false;
  }
  const auth = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");
  return auth === `Bearer ${secret}` || cronHeader === secret;
}

interface QueueRow {
  id: string;
  article_id: string;
  article_headline: string;
  platform: string;
  content: string;
  hashtags: string[];
  image_url: string | null;
  article_url: string;
  scheduled_for: string;
}

interface PostDetail {
  id: string;
  platform: string;
  headline: string;
  status: "sent" | "failed" | "skipped";
  bufferPostId?: string;
  error?: string;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return run();
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return run();
}

const DAILY_CAP = 10;

async function run() {
  const startedAt = Date.now();
  const supabase = createAdminClient();
  const now = new Date();

  // 1. Enforce daily cap — count posts already sent today
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count: sentToday } = await supabase
    .from("social_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", todayStart.toISOString());

  const remaining = DAILY_CAP - (sentToday ?? 0);
  if (remaining <= 0) {
    return NextResponse.json({
      message: `Daily cap reached (${DAILY_CAP}/day). Posts will resume tomorrow.`,
      sentToday: sentToday ?? 0,
    });
  }

  // windowStart was previously `now - 30min`, which meant a post that missed
  // its own narrow window for ANY reason (a transient Buffer error before the
  // "sending" claim, the daily cap being hit at that exact moment, a cron/auth
  // outage) fell permanently out of range — `scheduled_for` only recedes
  // further into the past relative to "now", so it could never be picked up
  // again. Confirmed in production: 64 LinkedIn + 30 Instagram posts stuck in
  // "pending" back to 2026-06-23, invisible because the UI shows the exact
  // same "Pending" label for a post that will and one that never will post.
  // Widened to a 24h lookback so a post recovers within one missed cron cycle
  // (cron only runs 8-18 UTC, so overnight gaps alone can be ~14h) without
  // reaching back far enough to resurrect the existing months-old backlog —
  // user's explicit call: leave those ~94 alone, don't sweep them in.
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // now - 24h
  const windowEnd   = new Date(now.getTime() +  5 * 60 * 1000);      // now + 5 min

  // 2. Fetch due posts — capped to remaining daily slots
  const { data: duePosts, error: fetchError } = await supabase
    .from("social_queue")
    .select("id, article_id, article_headline, platform, content, hashtags, image_url, article_url, scheduled_for")
    .eq("status", "pending")
    .gte("scheduled_for", windowStart.toISOString())
    .lte("scheduled_for", windowEnd.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(remaining);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const posts = (duePosts ?? []) as QueueRow[];

  // 3. Nothing due
  if (posts.length === 0) {
    return NextResponse.json({ message: "No posts due", checked_at: now.toISOString() });
  }

  // 4. Build platform → Buffer profile ID map
  let profileMap: Record<string, string> = {};
  const warnings: string[] = [];

  try {
    const profiles: BufferProfile[] = await getBufferProfiles();
    for (const p of profiles) {
      profileMap[p.service] = p.id;
    }
  } catch (err) {
    // Buffer not configured — log and skip all posts rather than crash
    warnings.push(`Buffer profiles unavailable: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 5. Publish each due post
  const details: PostDetail[] = [];
  let postsSent = 0;
  let postsFailed = 0;

  for (const post of posts) {
    const profileId = profileMap[post.platform];

    if (!profileId) {
      warnings.push(`No Buffer profile for platform '${post.platform}' — skipping post ${post.id}`);
      details.push({ id: post.id, platform: post.platform, headline: post.article_headline, status: "skipped" });
      continue;
    }

    // a. Claim the row to prevent double-sends on overlapping cron runs
    const { data: claimed } = await supabase
      .from("social_queue")
      .update({ status: "sending" })
      .eq("id", post.id)
      .eq("status", "pending") // only succeeds if nobody else claimed it first
      .select("id");

    if (!claimed || claimed.length === 0) {
      // Another cron instance already claimed this post
      continue;
    }

    try {
      // b. Send to Buffer — clamp to a near-future time if this post is being
      // recovered after missing its original window (see windowStart comment
      // above). Buffer's API expects a future `dueAt`; passing a stale past
      // `scheduled_for` straight through (the old behavior) risked Buffer
      // rejecting the request or mishandling it for any post caught late.
      const dueAt = new Date(post.scheduled_for);
      const effectiveDueAt = dueAt <= now ? new Date(now.getTime() + 2 * 60 * 1000) : dueAt;
      const bufferPostId = await scheduleBufferPost(
        profileId,
        post.content,
        effectiveDueAt,
        post.image_url ?? undefined,
        post.platform
      );

      // c. Mark sent
      await supabase
        .from("social_queue")
        .update({ status: "sent", buffer_post_id: bufferPostId, sent_at: new Date().toISOString() })
        .eq("id", post.id);

      postsSent++;
      details.push({ id: post.id, platform: post.platform, headline: post.article_headline, status: "sent", bufferPostId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // d. Mark failed
      await supabase
        .from("social_queue")
        .update({ status: "failed", error: message })
        .eq("id", post.id);

      postsFailed++;
      details.push({ id: post.id, platform: post.platform, headline: post.article_headline, status: "failed", error: message });
    }
  }

  // 6. Log run
  await supabase.from("social_runs").insert({
    trigger:         "cron",
    articles_found:  0,   // publish run — articles already queued
    posts_generated: 0,
    posts_queued:    posts.length,
    posts_sent:      postsSent,
    errors:          details.filter((d) => d.status === "failed"),
    duration_ms:     Date.now() - startedAt,
  });

  // 7. Return summary
  return NextResponse.json({ postsSent, postsFailed, sentToday: (sentToday ?? 0) + postsSent, dailyCap: DAILY_CAP, warnings, details });
}
