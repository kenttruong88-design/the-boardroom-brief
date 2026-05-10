import { NextResponse } from "next/server";
import { client as sanityClient } from "@/app/lib/sanity";
import { generateSocialPost } from "@/app/lib/social/content-generator";
import { getBufferProfiles, scheduleBufferPost } from "@/app/lib/social/buffer-client";
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

interface LiveBody {
  platforms: Platform[];
  articleId?: string;
  confirmLive?: boolean;
  confirmText?: string;
}

const REQUIRED_CONFIRM_TEXT = "I understand this will post publicly";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test routes are disabled in production" }, { status: 403 });
  }

  const body = (await req.json()) as LiveBody;

  if (!body.confirmLive || body.confirmText !== REQUIRED_CONFIRM_TEXT) {
    return NextResponse.json(
      {
        error: "Double confirmation required",
        instructions: {
          confirmLive: "Set confirmLive: true",
          confirmText: `Set confirmText: "${REQUIRED_CONFIRM_TEXT}"`,
          warning:     "THIS WILL POST PUBLICLY to your connected social accounts.",
        },
      },
      { status: 400 }
    );
  }

  const validPlatforms: Platform[] = ["linkedin", "twitter", "instagram"];
  const platforms = (body.platforms ?? []).filter((p) => validPlatforms.includes(p));
  if (platforms.length === 0) {
    return NextResponse.json({ error: "At least one valid platform required" }, { status: 400 });
  }

  // Resolve article
  let article: SanityArticle = MOCK_ARTICLE;
  if (sanityClient) {
    const query = body.articleId
      ? `*[_type == "article" && _id == $id][0]`
      : `*[_type == "article"] | order(publishedAt desc) [0]`;
    const params = body.articleId ? { id: body.articleId } : {};
    const found = await sanityClient.fetch<SanityArticle | null>(
      `${query} { _id, title, slug, satiricalHeadline, excerpt, heroImageUrl, publishedAt, pillar->{ name, slug, color }, countries[]->{ name, slug, code } }`,
      params
    );
    if (found) article = found;
  }

  const profilesList = await getBufferProfiles();
  const profileMap = Object.fromEntries(profilesList.map((p) => [p.service, p.id]));

  const supabase = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const pillarSlug = article.pillar?.slug?.current ?? "";
  const articleUrl = `${siteUrl}/${pillarSlug}/${article.slug.current}`;
  const now = new Date();
  const twoMinsFromNow = new Date(now.getTime() + 2 * 60 * 1000);

  const posted = await Promise.all(
    platforms.map(async (platform) => {
      const profileId = profileMap[platform];
      if (!profileId) {
        return {
          platform,
          error: `No Buffer profile connected for ${platform}`,
        };
      }

      const post = await generateSocialPost(article, platform);
      const bufferId = await scheduleBufferPost(
        profileId,
        post.content,
        twoMinsFromNow,
        post.imageUrl ?? undefined,
        platform
      );

      await supabase.from("social_queue").insert({
        article_id:       article._id,
        article_slug:     article.slug.current,
        article_headline: article.title,
        platform,
        content:          post.content,
        hashtags:         post.hashtags,
        image_url:        post.imageUrl,
        article_url:      articleUrl,
        scheduled_for:    twoMinsFromNow.toISOString(),
        buffer_post_id:   bufferId,
        sent_at:          now.toISOString(),
        pillar:           pillarSlug,
        status:           "sent",
        generated_by:     "test",
      });

      return {
        platform,
        content:       post.content,
        charCount:     post.content.length,
        scheduledFor:  "2 minutes from now",
        bufferId,
        cancelUrl:     "https://buffer.com/app/publishing",
        message:       "Will post in ~2 minutes. Open Buffer to cancel if needed.",
      };
    })
  );

  return NextResponse.json({
    posted,
    warning:    "Posts will go live in ~2 minutes. Visit buffer.com/app to cancel.",
    articleUrl,
  });
}
