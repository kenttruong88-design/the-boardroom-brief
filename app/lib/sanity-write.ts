import { writeClient } from "@/app/lib/sanity";
import type { ArticleDraft } from "@/app/lib/agents/types";

export interface SanityPublishResult {
  sanityDocId: string;
  slug: string;
  publishedUrl: string;
}

const PILLAR_NAMES: Record<string, string> = {
  "markets-floor":  "Markets Floor",
  "macro-mondays":  "Macro Mondays",
  "c-suite-circus": "C-Suite Circus",
  "global-office":  "Global Office",
  "water-cooler":   "Water Cooler",
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

async function ensurePillarExists(pillarSlug: string): Promise<string> {
  // Use the slug as the document _id so the reference is stable and predictable
  await writeClient!.createIfNotExists({
    _id: pillarSlug,
    _type: "pillar",
    name: PILLAR_NAMES[pillarSlug] ?? pillarSlug,
    slug: { _type: "slug", current: pillarSlug },
  });
  return pillarSlug;
}

export async function createSanityArticle(
  draft: ArticleDraft,
  status: "published" | "draft" = "published"
): Promise<SanityPublishResult> {
  if (!writeClient) {
    throw new Error("Sanity write client not configured — check SANITY_API_TOKEN");
  }

  const slug = slugify(draft.headline);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealignmenttimes.com";

  const pillarId = await ensurePillarExists(draft.pillar);

  const doc: Record<string, unknown> = {
    _type: "article",
    title: draft.headline,
    slug: { _type: "slug", current: slug },
    satiricalHeadline: draft.satiricalHeadline,
    excerpt: draft.body.split("\n\n")[0].slice(0, 300),
    body: draft.body.split("\n\n").map((para, i) => ({
      _type: "block",
      _key: `p${i}`,
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: `s${i}`, text: para, marks: [] }],
    })),
    pillar: { _type: "reference", _ref: pillarId },
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    tags: draft.tags,
    tone: draft.tone,
    publishedAt: status === "published" ? new Date().toISOString() : null,
    aiGenerated: true,
    agentName: draft.agentName,
    featured: false,
    status,
  };

  if (draft.featuredImage) {
    doc.featuredImage = {
      _type: "image",
      asset: { _type: "reference", url: draft.featuredImage.heroUrl },
      alt: draft.featuredImage.altText,
    };
    doc.ogImage              = draft.featuredImage.ogImageUrl;
    doc.imagePrompt          = draft.featuredImage.generatedPrompt ?? null;
    doc.imageGeneratedWith   = draft.featuredImage.source;
    doc.imagePhotographerName = draft.featuredImage.photographerName ?? null;
    doc.imagePhotographerUrl  = draft.featuredImage.photographerUrl ?? null;
    doc.imagePexelsUrl        = draft.featuredImage.pexelsPageUrl ?? null;
  }

  const created = await writeClient.create(doc);

  // Trigger ISR revalidation — non-fatal if it fails
  await fetch(
    `${siteUrl}/api/revalidate?secret=${process.env.REVALIDATE_SECRET}&path=/${draft.pillar}`,
    { method: "POST" }
  ).catch(() => {});

  return {
    sanityDocId: created._id,
    slug,
    publishedUrl: `${siteUrl}/${draft.pillar}/${slug}`,
  };
}
