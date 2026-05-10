import { NextResponse } from "next/server";
import { client as sanityClient } from "@/app/lib/sanity";
import { generateSocialPost } from "@/app/lib/social/content-generator";
import { getBufferProfiles, createBufferDraft } from "@/app/lib/social/buffer-client";
import { createAdminClient } from "@/app/lib/supabase-server";
import type { SanityArticle } from "@/app/lib/queries";

type Platform = "linkedin" | "twitter" | "instagram";

const MOCK_ARTICLE: SanityArticle = {
  _id: "test-article-001",
  title: "Goldman Sachs Reports Record Q3 Profits, Immediately Announces Restructuring",
  satiricalHeadline: "Exceeds All Targets. Celebrates By Changing Everything.",
  slug: { current: "goldman-sachs-q3-2026" },
  excerpt: "Goldman Sachs reported record third-quarter profits of $12.4 billion on Tuesday.",
  publishedAt: new Date().toISOString(),
  heroImageUrl: "https://images.pexels.com/photos/534216/pexels-photo-534216.jpeg",
  pillar: { name: "C-Suite Circus", slug: { current: "c-suite-circus" } },
  countries: [{ name: "United States", slug: { current: "usa" } }],
};

interface DraftBody {
  platform: Platform;
  articleId?: string;
  confirmDraft?: boolean;
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test routes are disabled in production" }, { status: 403 });
  }

  const body = (await req.json()) as DraftBody;

  if (!body.confirmDraft) {
    return NextResponse.json(
      {
        error:       "Safety gate: confirmDraft must be true",
        instructions: "Add `confirmDraft: true` to your request body to proceed. This will add a post to your Buffer queue as a draft (no scheduled_at). Review and delete it in your Buffer dashboard if needed.",
      },
      { status: 400 }
    );
  }

  const validPlatforms: Platform[] = ["linkedin", "twitter", "instagram"];
  if (!validPlatforms.includes(body.platform)) {
    return NextResponse.json({ error: "platform must be linkedin | twitter | instagram" }, { status: 400 });
  }

  // Resolve article
  let article: SanityArticle = MOCK_ARTICLE;
  if (sanityClient && body.articleId) {
    const found = await sanityClient.fetch<SanityArticle | null>(
      `*[_type == "article" && _id == $id][0] { _id, title, slug, satiricalHeadline, excerpt, heroImageUrl, publishedAt, pillar->{ name, slug, color }, countries[]->{ name, slug, code } }`,
      { id: body.articleId }
    );
    if (found) article = found;
  } else if (sanityClient) {
    const latest = await sanityClient.fetch<SanityArticle | null>(
      `*[_type == "article"] | order(publishedAt desc) [0] { _id, title, slug, satiricalHeadline, excerpt, heroImageUrl, publishedAt, pillar->{ name, slug, color }, countries[]->{ name, slug, code } }`
    );
    if (latest) article = latest;
  }

  // Generate content
  const post = await generateSocialPost(article, body.platform);

  // Get Buffer profile
  const profiles = await getBufferProfiles();
  const profile = profiles.find((p) => p.service === body.platform);
  if (!profile) {
    return NextResponse.json(
      { error: `No Buffer profile connected for ${body.platform}. Connect it at buffer.com.` },
      { status: 400 }
    );
  }

  // Send as draft (no scheduled_at)
  const bufferId = await createBufferDraft(profile.id, post.content, post.imageUrl ?? undefined, body.platform);

  // Insert into social_queue with draft_test status — won't be picked up by publisher cron
  const supabase = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const pillarSlug = article.pillar?.slug?.current ?? "";

  await supabase.from("social_queue").insert({
    article_id:       article._id,
    article_slug:     article.slug.current,
    article_headline: article.title,
    platform:         body.platform,
    content:          post.content,
    hashtags:         post.hashtags,
    image_url:        post.imageUrl,
    article_url:      `${siteUrl}/${pillarSlug}/${article.slug.current}`,
    scheduled_for:    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    buffer_post_id:   bufferId,
    pillar:           pillarSlug,
    status:           "draft_test",
    generated_by:     "test",
  });

  return NextResponse.json({
    success:        true,
    platform:       body.platform,
    content:        post.content,
    charCount:      post.content.length,
    bufferId,
    bufferDraftUrl: "https://buffer.com/app/publishing",
    message:        "Draft added to Buffer queue. Open your Buffer dashboard to review it.",
    nextStep:       "If the draft looks correct, run /api/test/social/live to send a real post.",
  });
}
