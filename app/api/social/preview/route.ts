import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { client as sanityClient } from "@/app/lib/sanity";
import { generateSocialPost } from "@/app/lib/social/content-generator";
import type { SanityArticle } from "@/app/lib/queries";

type Platform = "linkedin" | "twitter" | "instagram";

const SLOTS: Record<Platform, { h: number; m: number }[]> = {
  linkedin:  [{ h: 8,  m: 30 }, { h: 17, m: 0  }],
  twitter:   [{ h: 9,  m: 0  }, { h: 13, m: 0  }, { h: 17, m: 30 }],
  instagram: [{ h: 12, m: 0  }],
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

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (!sanityClient) {
    return NextResponse.json({ error: "Sanity not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("articleId");

  const query = articleId
    ? `*[_type == "article" && _id == $id][0]`
    : `*[_type == "article"] | order(publishedAt desc) [0]`;
  const params = articleId ? { id: articleId } : {};

  const article = await sanityClient.fetch<SanityArticle | null>(
    `${query} { _id, title, slug, satiricalHeadline, excerpt, heroImageUrl, publishedAt, pillar->{ name, slug, color }, countries[]->{ name, slug, code } }`,
    params
  );

  if (!article) {
    return NextResponse.json({ error: "No article found" }, { status: 404 });
  }

  const totalStart = Date.now();
  const platforms: Platform[] = ["linkedin", "twitter", "instagram"];

  const posts = await Promise.all(
    platforms.map(async (platform) => {
      const post = await generateSocialPost(article, platform);
      const firstLine = post.content.split("\n")[0] ?? "";
      const validations =
        platform === "linkedin"
          ? {
              hooksBeforeFold: firstLine.length <= 150,
              hookLength:       firstLine.length,
              endsWithQuestion: post.content.trimEnd().endsWith("?"),
            }
          : platform === "twitter"
          ? {
              underCharLimit: post.content.length <= 215,
              charCount:      post.content.length,
              remaining:      215 - post.content.length,
            }
          : {
              hasImage:     post.imageUrl !== null,
              hasLinkInBio: post.content.toLowerCase().includes("link in bio"),
            };

      return {
        platform,
        data: {
          content:       post.content,
          hashtags:      post.hashtags,
          charCount:     post.content.length,
          imageUrl:      post.imageUrl,
          estimatedSlot: nextSlotFor(platform).toISOString(),
          review:        post.review,
          validations,
        },
      };
    })
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const pillarSlug = article.pillar?.slug?.current ?? "";

  return NextResponse.json({
    article: {
      headline:   article.title,
      pillar:     pillarSlug,
      articleUrl: `${siteUrl}/${pillarSlug}/${article.slug.current}`,
    },
    posts: Object.fromEntries(posts.map(({ platform, data }) => [platform, data])),
    totalMs: Date.now() - totalStart,
  });
}
