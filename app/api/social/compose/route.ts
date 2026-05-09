import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { client as sanityClient } from "@/app/lib/sanity";
import { generateSocialPost } from "@/app/lib/social/content-generator";
import type { SanityArticle } from "@/app/lib/queries";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { articleId, platform } = (await req.json()) as {
    articleId: string;
    platform: string;
  };

  if (!articleId || !platform) {
    return NextResponse.json({ error: "articleId and platform required" }, { status: 400 });
  }

  if (!sanityClient) {
    return NextResponse.json({ error: "Sanity not configured" }, { status: 500 });
  }

  const article = await sanityClient.fetch<SanityArticle | null>(
    `*[_type == "article" && _id == $id][0] {
      _id, title, slug, satiricalHeadline, excerpt, heroImageUrl, publishedAt,
      pillar->{ name, slug, color },
      countries[]->{ name, slug, code }
    }`,
    { id: articleId }
  );

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const post = await generateSocialPost(
    article,
    platform as "linkedin" | "twitter" | "instagram"
  );

  return NextResponse.json({
    content:  post.content,
    hashtags: post.hashtags,
    imageUrl: post.imageUrl,
    articleUrl: post.articleUrl,
  });
}
