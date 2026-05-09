import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import {
  getBufferProfiles,
  scheduleBufferPost,
  type BufferProfile,
} from "@/app/lib/social/buffer-client";

export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");
  return (
    auth === `Bearer ${process.env.CRON_SECRET}` ||
    cronHeader === process.env.CRON_SECRET
  );
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

async function run() {
  const startedAt = Date.now();
  const supabase = createAdminClient();
  const now = new Date();

  const windowStart = new Date(now.getTime() - 30 * 60 * 1000); // now - 30 min
  const windowEnd   = new Date(now.getTime() +  5 * 60 * 1000); // now + 5 min

  // 1. Fetch due posts
  const { data: duePosts, error: fetchError } = await supabase
    .from("social_queue")
    .select("id, article_id, article_headline, platform, content, hashtags, image_url, article_url, scheduled_for")
    .eq("status", "pending")
    .gte("scheduled_for", windowStart.toISOString())
    .lte("scheduled_for", windowEnd.toISOString())
    .order("scheduled_for", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const posts = (duePosts ?? []) as QueueRow[];

  // 2. Nothing due
  if (posts.length === 0) {
    return NextResponse.json({ message: "No posts due", checked_at: now.toISOString() });
  }

  // 3. Build platform → Buffer profile ID map
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

  // 4. Publish each due post
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
    const { count } = await supabase
      .from("social_queue")
      .update({ status: "sending" })
      .eq("id", post.id)
      .eq("status", "pending") // only succeeds if nobody else claimed it first
      .select("id", { count: "exact", head: true });

    if (!count) {
      // Another cron instance already claimed this post
      continue;
    }

    try {
      // b. Send to Buffer
      const bufferPostId = await scheduleBufferPost(
        profileId,
        post.content,
        new Date(post.scheduled_for),
        post.image_url ?? undefined
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

  // 5. Log run
  await supabase.from("social_runs").insert({
    trigger:         "cron",
    articles_found:  0,   // publish run — articles already queued
    posts_generated: 0,
    posts_queued:    0,
    posts_sent:      postsSent,
    errors:          details.filter((d) => d.status === "failed"),
    duration_ms:     Date.now() - startedAt,
  });

  // 6. Return summary
  return NextResponse.json({ postsSent, postsFailed, warnings, details });
}
