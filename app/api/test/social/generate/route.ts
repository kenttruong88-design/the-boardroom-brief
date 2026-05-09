import { NextResponse } from "next/server";
import { client as sanityClient } from "@/app/lib/sanity";
import { generateSocialPost } from "@/app/lib/social/content-generator";
import type { SanityArticle } from "@/app/lib/queries";

type Platform = "linkedin" | "twitter" | "instagram";
const ALL_PLATFORMS: Platform[] = ["linkedin", "twitter", "instagram"];

const MOCK_ARTICLE: SanityArticle = {
  _id: "test-article-001",
  title: "Goldman Sachs Reports Record Q3 Profits, Immediately Announces Restructuring",
  satiricalHeadline: "Exceeds All Targets. Celebrates By Changing Everything.",
  slug: { current: "goldman-sachs-q3-2026" },
  excerpt:
    "Goldman Sachs reported record third-quarter profits of $12.4 billion on Tuesday, beating analyst estimates by 18%. The firm immediately announced a sweeping restructuring that would eliminate 3,200 roles.",
  publishedAt: new Date().toISOString(),
  heroImageUrl: "https://images.pexels.com/photos/534216/pexels-photo-534216.jpeg",
  pillar: { name: "C-Suite Circus", slug: { current: "c-suite-circus" } },
  countries: [{ name: "United States", slug: { current: "usa" } }],
};

async function resolveArticle(articleId?: string | null): Promise<SanityArticle> {
  if (!sanityClient) return MOCK_ARTICLE;

  if (articleId) {
    const found = await sanityClient.fetch<SanityArticle | null>(
      `*[_type == "article" && _id == $id][0] {
        _id, title, slug, satiricalHeadline, excerpt, heroImageUrl, publishedAt,
        pillar->{ name, slug, color }, countries[]->{ name, slug, code }
      }`,
      { id: articleId }
    );
    if (found) return found;
  }

  const latest = await sanityClient.fetch<SanityArticle | null>(
    `*[_type == "article"] | order(publishedAt desc) [0] {
      _id, title, slug, satiricalHeadline, excerpt, heroImageUrl, publishedAt,
      pillar->{ name, slug, color }, countries[]->{ name, slug, code }
    }`
  );

  return latest ?? MOCK_ARTICLE;
}

function validateLinkedIn(content: string, hashtags: string[]) {
  const firstLine = content.split("\n")[0] ?? "";
  return {
    hooksBeforeFold: firstLine.length <= 150,
    hookLength:      firstLine.length,
    endsWithQuestion: content.trimEnd().endsWith("?"),
    hashtagCount:    hashtags.length,
  };
}

function validateTwitter(content: string, hashtags: string[]) {
  const charCount = content.length;
  return {
    underCharLimit: charCount <= 215,
    charCount,
    remaining:      215 - charCount,
    hashtagCount:   hashtags.length,
  };
}

function validateInstagram(content: string, hashtags: string[], imageUrl: string | null) {
  return {
    hasImage:      imageUrl !== null,
    hashtagCount:  hashtags.length,
    hasLinkInBio:  content.toLowerCase().includes("link in bio"),
  };
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test routes are disabled in production" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const articleId   = searchParams.get("articleId");
  const platformArg = searchParams.get("platform") ?? "all";

  const platforms: Platform[] =
    platformArg === "all"
      ? ALL_PLATFORMS
      : ALL_PLATFORMS.filter((p) => p === platformArg);

  if (platforms.length === 0) {
    return NextResponse.json({ error: "Invalid platform. Use linkedin|twitter|instagram|all" }, { status: 400 });
  }

  const article = await resolveArticle(articleId);
  const totalStart = Date.now();

  // Generate requested platforms
  const timings: Record<string, number> = {};
  const posts: Record<string, unknown> = {};
  const validations: Record<string, unknown> = {};

  for (const platform of platforms) {
    const start = Date.now();
    try {
      const post = await generateSocialPost(article, platform);
      timings[`${platform}Ms`] = Date.now() - start;

      posts[platform] = {
        content:    post.content,
        hashtags:   post.hashtags,
        charCount:  post.content.length,
        imageUrl:   post.imageUrl,
        ...(platform === "linkedin" && { hookLength: (post.content.split("\n")[0] ?? "").length }),
        ...(platform === "twitter"  && { underLimit: post.content.length <= 215 }),
        ...(platform === "instagram" && { hasImage: post.imageUrl !== null }),
      };

      if (platform === "linkedin") {
        validations.linkedin = validateLinkedIn(post.content, post.hashtags);
      } else if (platform === "twitter") {
        validations.twitter = validateTwitter(post.content, post.hashtags);
      } else {
        validations.instagram = validateInstagram(post.content, post.hashtags, post.imageUrl);
      }
    } catch (err) {
      posts[platform] = { error: err instanceof Error ? err.message : String(err) };
      timings[`${platform}Ms`] = Date.now() - start;
    }
  }

  timings.totalMs = Date.now() - totalStart;

  // Rough cost estimate: ~2000 input + 400 output tokens per call @ Sonnet pricing
  const callCount = platforms.length;
  const estimatedCost = `~$${((callCount * 2000 / 1_000_000) * 3 + (callCount * 400 / 1_000_000) * 15).toFixed(4)}`;

  return NextResponse.json({
    article: {
      headline: article.title,
      pillar:   article.pillar?.slug?.current,
      slug:     article.slug.current,
    },
    posts,
    validations,
    timings,
    estimatedCost,
  });
}
