import { NextResponse } from "next/server";
import { callClaude, parseJSON } from "@/app/lib/claude";
import { createAdminClient } from "@/app/lib/supabase";
import { client as sanityClient } from "@/app/lib/sanity";

const SYSTEM_PROMPT = `You write social media copy for The Boardroom Brief. LinkedIn posts should be professional but entertaining — a senior manager would share them. Twitter/X posts should be punchy, quotable, and under 240 chars with a sardonic twist. Never use more than 2 hashtags. Never use more than 1 emoji.`;

interface SocialPost {
  linkedinPost: string;
  twitterPost: string;
}

function isAuthorized(req: Request): boolean {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") ?? req.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runQueue();
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runQueue();
}

async function postToBuffer(content: string, platform: "linkedin" | "twitter", scheduledFor: Date): Promise<string | null> {
  const bufferKey = process.env.BUFFER_API_KEY;
  const profileIds: Record<string, string | undefined> = {
    linkedin: process.env.BUFFER_LINKEDIN_PROFILE_ID,
    twitter:  process.env.BUFFER_TWITTER_PROFILE_ID,
  };

  if (!bufferKey || !profileIds[platform]) return null;

  try {
    const res = await fetch("https://api.bufferapp.com/1/updates/create.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        access_token: bufferKey,
        [`profile_ids[]`]: profileIds[platform]!,
        text: content,
        scheduled_at: scheduledFor.toISOString(),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { updates?: { id: string }[] };
    return data?.updates?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function runQueue() {
  if (!sanityClient) {
    return NextResponse.json({ skipped: true, reason: "Sanity not configured" });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://theboardroombrief.com";
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Fetch today's articles
  const articles = await sanityClient.fetch(
    `*[_type == "article" && publishedAt > "${since}"] | order(featured desc, publishedAt desc) [0...5] {
      _id, title, slug, satiricalHeadline, excerpt, pillar->{ slug }
    }`
  ) as {
    _id: string;
    title: string;
    slug: { current: string };
    satiricalHeadline?: string;
    excerpt?: string;
    pillar?: { slug: { current: string } };
  }[];

  if (articles.length === 0) {
    return NextResponse.json({ queued: 0, reason: "no articles today" });
  }

  const supabase = createAdminClient();
  let queued = 0;

  // Twitter post times: 9am, 1pm, 5pm UTC
  const twitterSlots = [9, 13, 17].map((h) => {
    const d = new Date();
    d.setUTCHours(h, 0, 0, 0);
    return d;
  });
  let twitterSlotIndex = 0;

  // LinkedIn: 8:30am UTC
  const linkedinTime = new Date();
  linkedinTime.setUTCHours(8, 30, 0, 0);

  for (const article of articles) {
    const url = `${siteUrl}/${article.pillar?.slug?.current ?? "markets-floor"}/${article.slug.current}`;

    const userPrompt = `Article: ${article.title}
Subheadline: ${article.satiricalHeadline ?? ""}
Excerpt: ${article.excerpt ?? ""}
URL: ${url}

Generate:
- linkedinPost (150-200 words, hook in first line, ends with a question to drive comments)
- twitterPost (under 240 chars, punchy, include the URL)
Return as JSON: {"linkedinPost": "...", "twitterPost": "..."}`;

    let posts: SocialPost;
    try {
      const { content } = await callClaude(SYSTEM_PROMPT, userPrompt, 600, "social-queue");
      posts = parseJSON<SocialPost>(content);
    } catch {
      continue;
    }

    // Queue LinkedIn post
    const liBufferId = await postToBuffer(posts.linkedinPost, "linkedin", linkedinTime);
    await supabase.from("social_queue").insert({
      article_id: article._id,
      platform: "linkedin",
      content: posts.linkedinPost,
      scheduled_for: linkedinTime.toISOString(),
      buffer_post_id: liBufferId,
    });

    // Queue Twitter post (rotate through time slots)
    const twTime = twitterSlots[twitterSlotIndex % twitterSlots.length];
    twitterSlotIndex++;
    const twBufferId = await postToBuffer(posts.twitterPost, "twitter", twTime);
    await supabase.from("social_queue").insert({
      article_id: article._id,
      platform: "twitter",
      content: posts.twitterPost,
      scheduled_for: twTime.toISOString(),
      buffer_post_id: twBufferId,
    });

    queued++;
    // Brief pause between Claude calls
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({ queued, articles: articles.length });
}
