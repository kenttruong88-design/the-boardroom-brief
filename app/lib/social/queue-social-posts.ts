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
  linkedin:  [{ h: 8,  m: 30 }, { h: 17, m: 0  }],
  twitter:   [{ h: 9,  m: 0  }, { h: 13, m: 0  }, { h: 17, m: 30 }],
  instagram: [{ h: 12, m: 0  }],
} as const;

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const articleUrl = `${siteUrl}/${pillarSlug}/${publishResult.slug}`;

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

  const [li, tw, ig] = await Promise.all([
    generateSocialPost(article, "linkedin"),
    generateSocialPost(article, "twitter"),
    generateSocialPost(article, "instagram"),
  ]);

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

  await Promise.all([
    supabase.from("social_queue").insert({
      ...base,
      platform:      "linkedin",
      content:       li.content,
      hashtags:      li.hashtags,
      image_url:     li.imageUrl,
      scheduled_for: nextSlot("linkedin", now).toISOString(),
    }),
    supabase.from("social_queue").insert({
      ...base,
      platform:      "twitter",
      content:       tw.content,
      hashtags:      tw.hashtags,
      image_url:     tw.imageUrl,
      scheduled_for: nextSlot("twitter", now).toISOString(),
    }),
    supabase.from("social_queue").insert({
      ...base,
      platform:      "instagram",
      content:       ig.content,
      hashtags:      ig.hashtags,
      image_url:     ig.imageUrl,
      scheduled_for: nextSlot("instagram", now).toISOString(),
    }),
  ]);
}
