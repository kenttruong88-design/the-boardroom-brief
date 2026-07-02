import { createAdminClient } from "@/app/lib/supabase-server";
import { generateSocialPost } from "./content-generator";
import type { ArticleDraft } from "@/app/lib/agents/types";
import type { SanityArticle } from "@/app/lib/queries";
import type { SanityPublishResult } from "@/app/lib/sanity-write";

const PILLAR_NAMES: Record<string, string> = {
  "markets-floor":  "Markets Floor",
  "macro-mondays":  "Macro Mondays",
  "c-suite-circus": "C-Suite Circus",
  "global-office":  "Global Office",
  "water-cooler":   "Water Cooler",
};

const SOCIAL_SLOTS = {
  linkedin:  [{ h: 7,  m: 0  }, { h: 12, m: 0  }],
  twitter:   [{ h: 12, m: 0  }, { h: 16, m: 0  }, { h: 20, m: 0  }],
  instagram: [{ h: 11, m: 0  }],
} as const;

// Pillar → platform routing: each pillar posts to ONE platform only
const PILLAR_PLATFORMS: Record<string, ("linkedin" | "twitter" | "instagram")[]> = {
  "markets-floor":  ["twitter"],
  "macro-mondays":  ["twitter"],
  "c-suite-circus": ["linkedin"],
  "global-office":  ["linkedin"],
  "out-of-office":  ["instagram"],
  "water-cooler":   ["linkedin", "instagram"],
};

function nextSlot(platform: "linkedin" | "twitter" | "instagram", now: Date): Date {
  for (const { h, m } of SOCIAL_SLOTS[platform]) {
    const candidate = new Date(now);
    candidate.setUTCHours(h, m, 0, 0);
    if (candidate > now) return candidate;
  }
  const first = SOCIAL_SLOTS[platform][0];
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(first.h, first.m, 0, 0);
  return tomorrow;
}

export async function queueSocialPostsForArticle(
  draft: ArticleDraft,
  publishResult: SanityPublishResult
): Promise<void> {
  const now = new Date();
  const pillarSlug = draft.pillar;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.thealignmenttimes.com";
  const articleUrl = `${siteUrl}/${pillarSlug}/${publishResult.slug}`;
  const hasImage = !!draft.featuredImage?.heroUrl;

  const article: SanityArticle = {
    _id:               publishResult.sanityDocId,
    title:             draft.headline,
    slug:              { current: publishResult.slug },
    satiricalHeadline: draft.satiricalHeadline,
    excerpt:           draft.body.split("\n\n")[0].slice(0, 300),
    publishedAt:       now.toISOString(),
    heroImageUrl:      draft.featuredImage?.heroUrl,
    pillar: {
      name: PILLAR_NAMES[pillarSlug] ?? pillarSlug,
      slug: { current: pillarSlug },
    },
    countries: draft.countries.map((c) => ({
      name: c,
      slug: { current: c.toLowerCase().replace(/\s+/g, "-") },
    })),
  };

  // Route to the correct platform(s) for this pillar
  const platforms = PILLAR_PLATFORMS[pillarSlug] ?? ["linkedin", "twitter"];

  const platformJobs: Promise<void>[] = [];
  const supabase = createAdminClient();

  const base = {
    article_id:       publishResult.sanityDocId,
    article_slug:     publishResult.slug,
    article_headline: draft.headline,
    article_url:      articleUrl,
    pillar:           pillarSlug,
    status:           "pending_approval",
    generated_by:     "auto",
  };

  type Platform = "linkedin" | "twitter" | "instagram";
  for (const platform of platforms as Platform[]) {
    platformJobs.push(
      generateSocialPost(article, platform).then((post) =>
        supabase.from("social_queue").insert({
          ...base,
          platform,
          content:        post.content,
          hashtags:       post.hashtags,
          image_url:      post.imageUrl,
          scheduled_for:  nextSlot(platform, now).toISOString(),
          review_score:   post.review?.score  ?? null,
          review_passed:  post.review?.passed ?? null,
          review_notes:   post.review?.notes  ?? null,
        }).then(() => undefined)
      )
    );
  }

  // Use allSettled so one platform failure doesn't drop the others
  const results = await Promise.allSettled(platformJobs);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[queue-social-posts] Platform generation failed:", result.reason);
    }
  }
}
