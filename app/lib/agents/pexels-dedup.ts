import { createClient } from "@sanity/client";
import { generateArticleImage } from "./image-generator";
import type { ArticleDraft, FeaturedImage } from "./types";

function getSanityClient() {
  return createClient({
    projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "e8dwtkci",
    dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET    ?? "production",
    apiVersion: "2024-01-01",
    useCdn:     false,
    token:      process.env.SANITY_API_TOKEN,
  });
}

// Pexels page URLs end in a numeric photo ID, e.g. .../photo/some-slug-1234567/
export function extractPexelsPhotoId(pexelsPageUrl: string): string | null {
  const m = pexelsPageUrl.match(/-(\d+)\/?$/);
  return m ? m[1] : null;
}

/** All Pexels photo IDs already live on published articles, across every pillar. */
export async function loadPublishedPexelsIds(): Promise<Set<string>> {
  const used = new Set<string>();
  try {
    const client = getSanityClient();
    const docs: { imagePexelsUrl?: string }[] = await client.fetch(
      `*[_type == "article" && defined(imagePexelsUrl)]{ imagePexelsUrl }`
    );
    for (const doc of docs) {
      const id = doc.imagePexelsUrl ? extractPexelsPhotoId(doc.imagePexelsUrl) : null;
      if (id) used.add(id);
    }
  } catch (err) {
    console.warn("[pexels-dedup] Failed to load published Pexels IDs:", (err as Error).message);
  }
  return used;
}

/**
 * A draft's image is chosen when it's written, but approval (publish to
 * Sanity) is a separate, human-gated step that can lag hours or days behind —
 * the exclude set it was written against can go stale in the meantime if
 * another draft's photo went live first. Re-check right before publish and
 * regenerate if the chosen photo has since been claimed by a published
 * article. Mutates `publishedIds` with whichever photo ends up used, so
 * callers approving several drafts in one pass (bulk-approve) can share one
 * set and avoid colliding with each other too.
 */
export async function dedupeFeaturedImage(
  draft: ArticleDraft,
  publishedIds: Set<string>
): Promise<ArticleDraft> {
  const image = draft.featuredImage;
  if (!image || image.source !== "pexels" || !image.pexelsPageUrl) return draft;

  const id = extractPexelsPhotoId(image.pexelsPageUrl);
  if (!id || !publishedIds.has(id)) {
    if (id) publishedIds.add(id);
    return draft;
  }

  console.warn(`[pexels-dedup] "${draft.headline}" — photo ${id} already published, regenerating image`);
  try {
    const fresh = await generateArticleImage(draft, publishedIds);
    const newImage: FeaturedImage = {
      cloudinaryPublicId: fresh.publicId,
      url:                fresh.url,
      heroUrl:            fresh.heroUrl,
      thumbnailUrl:       fresh.thumbnailUrl,
      ogImageUrl:         fresh.ogImageUrl,
      mobileUrl:          fresh.mobileUrl,
      altText:            image.altText,
      source:             fresh.source,
      photographerName:   fresh.photographerName,
      photographerUrl:    fresh.photographerUrl,
      pexelsPageUrl:      fresh.pexelsPageUrl,
      durationMs:         fresh.durationMs,
    };
    const newId = newImage.pexelsPageUrl ? extractPexelsPhotoId(newImage.pexelsPageUrl) : null;
    if (newId) publishedIds.add(newId);
    return { ...draft, featuredImage: newImage };
  } catch (err) {
    console.error(`[pexels-dedup] Regeneration failed for "${draft.headline}", keeping original image:`, (err as Error).message);
    return draft;
  }
}
