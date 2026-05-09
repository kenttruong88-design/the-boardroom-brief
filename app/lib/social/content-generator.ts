import { callClaude, parseJSON, MODELS } from "@/app/lib/claude";
import { PLATFORM_RULES } from "./platform-rules";
import type { SanityArticle } from "@/app/lib/queries";

type Platform = "linkedin" | "twitter" | "instagram";

export interface SocialPost {
  platform: Platform;
  content: string;
  hashtags: string[];
  imageUrl: string | null;
  articleUrl: string;
}

interface ClaudePostResponse {
  content: string;
  hashtags: string[];
  imageUrl: string | null;
}

export async function generateSocialPost(
  article: SanityArticle,
  platform: Platform
): Promise<SocialPost> {
  const rules = PLATFORM_RULES[platform];
  const pillarSlug = article.pillar?.slug?.current ?? "general";
  const articleUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/${pillarSlug}/${article.slug.current}`;
  const excerpt = (article.excerpt ?? "").slice(0, 300);
  const countries = article.countries?.map((c) => c.name).join(", ") ?? "Global";

  const userPrompt = `Write a ${platform} post for this article:

Headline: ${article.title}
Satirical subheadline: ${article.satiricalHeadline ?? ""}
Pillar: ${article.pillar?.name ?? ""}
Countries covered: ${countries}
Article excerpt (first 300 chars of body): ${excerpt}
Article URL: ${articleUrl}

For Twitter: the URL will be appended automatically — write copy only, do not include the URL in your response.
For LinkedIn and Instagram: end your post with the URL on its own line.

Return only valid JSON:
{
  "content": "string (the full post copy)",
  "hashtags": ["string array without # symbol"],
  "imageUrl": null
}`;

  const response = await callClaude(
    rules.systemPrompt,
    userPrompt,
    1200,
    `social:${platform}`,
    MODELS.default
  );

  const parsed = parseJSON<ClaudePostResponse>(response.content);

  // imageUrl is determined by platform, not Claude
  let imageUrl: string | null = null;
  if (platform === "instagram") {
    imageUrl = article.heroImageUrl ?? null;
  } else if (platform === "linkedin") {
    // heroImageUrl doubles as thumbnail — SanityArticle doesn't expose separate sizes
    imageUrl = article.heroImageUrl ?? null;
  }
  // twitter: null

  return {
    platform,
    content: parsed.content,
    hashtags: parsed.hashtags,
    imageUrl,
    articleUrl,
  };
}

export async function generateAllPlatformPosts(
  article: SanityArticle
): Promise<SocialPost[]> {
  const platforms: Platform[] = ["linkedin", "twitter", "instagram"];

  return Promise.all(
    platforms.map((platform, i) =>
      new Promise<SocialPost>((resolve, reject) =>
        setTimeout(
          () => generateSocialPost(article, platform).then(resolve, reject),
          i * 100
        )
      )
    )
  );
}
