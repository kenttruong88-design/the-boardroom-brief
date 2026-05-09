import { NextResponse } from "next/server";
import { client as sanityClient } from "@/app/lib/sanity";
import { generateSocialPost } from "@/app/lib/social/content-generator";
import { getBufferProfiles } from "@/app/lib/social/buffer-client";
import type { SanityArticle } from "@/app/lib/queries";

type Platform = "linkedin" | "twitter" | "instagram";

const MOCK_ARTICLE: SanityArticle = {
  _id: "test-article-001",
  title: "Goldman Sachs Reports Record Q3 Profits, Immediately Announces Restructuring",
  satiricalHeadline: "Exceeds All Targets. Celebrates By Changing Everything.",
  slug: { current: "goldman-sachs-q3-2026" },
  excerpt:
    "Goldman Sachs reported record third-quarter profits of $12.4 billion on Tuesday, beating analyst estimates by 18%.",
  publishedAt: new Date().toISOString(),
  heroImageUrl: "https://images.pexels.com/photos/534216/pexels-photo-534216.jpeg",
  pillar: { name: "C-Suite Circus", slug: { current: "c-suite-circus" } },
  countries: [{ name: "United States", slug: { current: "usa" } }],
};

// Next posting slot for each platform (simplified)
const SLOTS: Record<Platform, { h: number; m: number }[]> = {
  linkedin:  [{ h: 8, m: 30 }, { h: 17, m: 0 }],
  twitter:   [{ h: 9, m: 0 }, { h: 13, m: 0 }, { h: 17, m: 30 }],
  instagram: [{ h: 12, m: 0 }],
};

function nextSlotFor(platform: Platform): Date {
  const now = new Date();
  for (const { h, m } of SLOTS[platform]) {
    const t = new Date(now);
    t.setUTCHours(h, m, 0, 0);
    if (t > now) return t;
  }
  const first = SLOTS[platform][0];
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(first.h, first.m, 0, 0);
  return tomorrow;
}

async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test routes are disabled in production" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("articleId");

  // Resolve article
  let article: SanityArticle = MOCK_ARTICLE;
  if (sanityClient) {
    const query = articleId
      ? `*[_type == "article" && _id == $id][0]`
      : `*[_type == "article"] | order(publishedAt desc) [0]`;
    const params = articleId ? { id: articleId } : {};
    const found = await sanityClient.fetch<SanityArticle | null>(
      `${query} { _id, title, slug, satiricalHeadline, excerpt, heroImageUrl, publishedAt, pillar->{ name, slug, color }, countries[]->{ name, slug, code } }`,
      params
    );
    if (found) article = found;
  }

  const totalStart = Date.now();
  const platforms: Platform[] = ["linkedin", "twitter", "instagram"];

  // Generate all 3 posts
  const posts = await Promise.all(
    platforms.map(async (platform) => {
      const start = Date.now();
      const post = await generateSocialPost(article, platform);
      return { platform, post, ms: Date.now() - start };
    })
  );

  // Build profile map for buffer payload simulation
  let profileMap: Record<string, string> = {};
  try {
    const profiles = await getBufferProfiles();
    profileMap = Object.fromEntries(profiles.map((p) => [p.service, p.id]));
  } catch {
    // Buffer not configured — payload will show placeholder profile IDs
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const pillarSlug = article.pillar?.slug?.current ?? "";
  const articleUrl = `${siteUrl}/${pillarSlug}/${article.slug.current}`;

  // URL reachability checks
  const [urlReachable, imageReachable] = await Promise.all([
    articleUrl.startsWith("http") ? checkUrl(articleUrl) : Promise.resolve(false),
    article.heroImageUrl ? checkUrl(article.heroImageUrl) : Promise.resolve(false),
  ]);

  const result = Object.fromEntries(
    posts.map(({ platform, post, ms }) => [
      platform,
      {
        content:      post.content,
        hashtags:     post.hashtags,
        charCount:    post.content.length,
        imageUrl:     post.imageUrl,
        generatedMs:  ms,
        estimatedSlot: nextSlotFor(platform).toISOString(),
        bufferPayload: {
          profileId:   profileMap[platform] ?? "not-connected",
          text:        post.content,
          scheduledAt: nextSlotFor(platform).toISOString(),
          mediaUrl:    post.imageUrl,
        },
        validations: platform === "linkedin"
          ? {
              hooksBeforeFold: (post.content.split("\n")[0] ?? "").length <= 150,
              endsWithQuestion: post.content.trimEnd().endsWith("?"),
              hashtagCount: post.hashtags.length,
            }
          : platform === "twitter"
          ? {
              underCharLimit: post.content.length <= 215,
              charCount:      post.content.length,
              remaining:      215 - post.content.length,
              hashtagCount:   post.hashtags.length,
            }
          : {
              hasImage:      post.imageUrl !== null,
              hashtagCount:  post.hashtags.length,
              hasLinkInBio:  post.content.toLowerCase().includes("link in bio"),
            },
      },
    ])
  );

  return NextResponse.json({
    article: {
      headline:   article.title,
      pillar:     pillarSlug,
      slug:       article.slug.current,
      articleUrl,
    },
    urlReachable,
    imageReachable,
    posts: result,
    totalMs: Date.now() - totalStart,
    estimatedCost: `~$${((3 * 2000 / 1_000_000) * 3 + (3 * 400 / 1_000_000) * 15).toFixed(4)}`,
  });
}
