import { callClaude, parseJSON, MODELS } from "@/app/lib/claude";
import { PLATFORM_RULES } from "./platform-rules";
import { reviewSocialPost, reviseSocialPost } from "./social-review";
import type { SocialPostReview } from "./social-review";
import type { SanityArticle } from "@/app/lib/queries";

export type { SocialPostReview };

type Platform = "linkedin" | "twitter" | "instagram";

// ── Hashtag fallbacks per pillar + platform ───────────────────────────────────
// Used to pad up to the minimum when Claude returns fewer than required.

const PILLAR_HASHTAGS: Record<string, string[]> = {
  "markets-floor":  ["StockMarket", "Finance", "Investing", "Markets", "FinTwit", "Stocks", "Trading"],
  "macro-mondays":  ["MacroEconomics", "Economics", "CentralBank", "Inflation", "GlobalEconomy", "FederalReserve"],
  "c-suite-circus": ["Business", "Corporate", "Leadership", "CEO", "MergersAndAcquisitions", "BoardroomNews"],
  "global-office":  ["WorkplaceCulture", "FutureOfWork", "RemoteWork", "GlobalBusiness", "HR", "WorkLife"],
  "water-cooler":   ["CorporateLife", "OfficeHumour", "WorkHumour", "LinkedIn", "BusinessCulture", "Corporate"],
  "out-of-office":  ["Travel", "WorkLifeBalance", "CultureShock", "Expat", "DigitalNomad", "OutOfOffice", "Lifestyle"],
  "general":        ["BusinessNews", "Finance", "Economics", "Corporate", "GlobalBusiness"],
};

const PLATFORM_MIN_HASHTAGS: Record<Platform, number> = {
  linkedin:  3,
  twitter:   3,
  instagram: 5,
};

function padHashtags(hashtags: string[], pillarSlug: string, platform: Platform): string[] {
  const min = PLATFORM_MIN_HASHTAGS[platform];
  if (hashtags.length >= min) return hashtags;
  const existing = new Set(hashtags.map(h => h.toLowerCase()));
  const fallbacks = PILLAR_HASHTAGS[pillarSlug] ?? PILLAR_HASHTAGS["general"];
  const padded = [...hashtags];
  for (const tag of fallbacks) {
    if (padded.length >= min) break;
    if (!existing.has(tag.toLowerCase())) {
      padded.push(tag);
      existing.add(tag.toLowerCase());
    }
  }
  return padded;
}

export interface SocialPost {
  platform: Platform;
  content: string;
  hashtags: string[];
  imageUrl: string | null;
  articleUrl: string;
  review: SocialPostReview | null;
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const articleUrl = `${siteUrl}/${pillarSlug}/${article.slug.current}`;
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

STRICT RULE — No specific market numbers: do not quote any stock prices, index levels, percentage moves, basis points, earnings figures, or any other numerical market data. Describe direction and significance in words (e.g. "surged", "hit a record", "fell sharply") but never cite the actual figure. This prevents publishing stale or incorrect data.

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
    MODELS.fast
  );

  const parsed = parseJSON<ClaudePostResponse>(response.content);

  // imageUrl is determined by platform, not Claude
  let imageUrl: string | null = null;
  if (platform === "instagram") {
    imageUrl = article.heroImageUrl ?? null;
  } else if (platform === "linkedin") {
    imageUrl = article.heroImageUrl ?? null;
  }
  // twitter: null

  let content = parsed.content;
  let hashtags = parsed.hashtags;

  // ── Editor review ─────────────────────────────────────────────────────────────
  let review: SocialPostReview | null = null;
  try {
    review = await reviewSocialPost(platform, content, hashtags, article.title);

    if (!review.passed) {
      const excerpt = (article.excerpt ?? "").slice(0, 300);
      const revised = await reviseSocialPost(
        platform, content, hashtags, review, article.title, excerpt
      );
      content = revised.content;
      hashtags = revised.hashtags;
      // Re-review once after revision
      review = await reviewSocialPost(platform, content, hashtags, article.title);
    }
  } catch (err) {
    console.warn(`[social] Editor review failed for ${platform}:`, err);
  }

  // Enforce minimum hashtag count — pad with pillar-specific fallbacks if needed
  hashtags = padHashtags(hashtags, pillarSlug, platform);

  return {
    platform,
    content,
    hashtags,
    imageUrl,
    articleUrl,
    review,
  };
}

// Which platforms each pillar posts to.
// Twitter  → stocks & macro (humour/satire)
// LinkedIn → corporate culture & office demeanor
// Instagram → Out of Office & workplace relationships
const PILLAR_PLATFORMS: Record<string, Platform[]> = {
  "markets-floor":  ["twitter"],
  "macro-mondays":  ["twitter"],
  "c-suite-circus": ["linkedin"],
  "global-office":  ["linkedin"],
  "water-cooler":   ["linkedin", "instagram"],
  "out-of-office":  ["instagram"],
};

export function platformsForPillar(pillarSlug: string): Platform[] {
  return PILLAR_PLATFORMS[pillarSlug] ?? ["linkedin"];
}

export async function generateAllPlatformPosts(
  article: SanityArticle
): Promise<SocialPost[]> {
  const pillarSlug = article.pillar?.slug?.current ?? "general";
  const platforms = platformsForPillar(pillarSlug);

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
