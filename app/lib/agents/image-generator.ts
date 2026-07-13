import { v2 as cloudinary } from "cloudinary";
import type { ArticleDraft } from "./types";

// ── Cloudinary config ─────────────────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CloudinaryResult {
  publicId:     string;
  url:          string;
  heroUrl:      string;
  thumbnailUrl: string;
  ogImageUrl:   string;
  mobileUrl:    string;
}

export interface ArticleImageResult extends CloudinaryResult {
  source:           "pexels" | "pillar-default";
  photographerName?: string;
  photographerUrl?:  string;
  pexelsPageUrl?:    string;
  durationMs:        number;
}

interface PexelsResult {
  buffer:           Buffer;
  photographerName: string;
  photographerUrl:  string;
  pexelsPageUrl:    string;
}

// ── Pillar config ─────────────────────────────────────────────────────────────

const PILLAR_SEARCH_TERMS: Record<string, string> = {
  "markets-floor":  "finance business",
  "macro-mondays":  "economy government",
  "c-suite-circus": "corporate office business",
  "global-office":  "office workplace",
  "water-cooler":   "coffee office casual",
  "out-of-office":  "travel lifestyle culture city",
};

const PILLAR_DEFAULT_IDS: Record<string, string> = {
  "markets-floor":  "boardroom-brief/defaults/markets-floor-default",
  "macro-mondays":  "boardroom-brief/defaults/macro-mondays-default",
  "c-suite-circus": "boardroom-brief/defaults/c-suite-circus-default",
  "global-office":  "boardroom-brief/defaults/global-office-default",
  "water-cooler":   "boardroom-brief/defaults/water-cooler-default",
  "out-of-office":  "boardroom-brief/defaults/out-of-office-default",
};

// ── 1. Pexels ─────────────────────────────────────────────────────────────────

// Tracks photo IDs already used this process lifetime so a single batch run
// (which generates many articles back to back) doesn't keep picking the same
// top search result for similar queries.
const usedPexelsIds = new Set<string>();

export async function fetchPexelsImage(
  keywords: string[],
  pillar: string,
  excludeIds?: Set<string>
): Promise<PexelsResult | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    console.warn("[image-generator] PEXELS_API_KEY not set — skipping Pexels fallback");
    return null;
  }

  const pillarTerms = PILLAR_SEARCH_TERMS[pillar] ?? "business";
  const keywordPart = keywords.slice(0, 3).join(" ");
  const q = encodeURIComponent(`${keywordPart} ${pillarTerms}`.trim());

  const searchRes = await fetch(
    `https://api.pexels.com/v1/search?query=${q}&orientation=landscape&per_page=15&size=large`,
    { headers: { Authorization: key } }
  );

  if (!searchRes.ok) {
    console.warn(`[image-generator] Pexels search failed: ${searchRes.status}`);
    return null;
  }

  const data = await searchRes.json() as {
    photos: Array<{
      id: number;
      src: { large2x: string };
      photographer: string;
      photographer_url: string;
      url: string;
    }>;
  };

  // Prefer a photo we haven't used yet — checked against both this run's
  // in-memory set and, when the caller passes one, photos already published
  // in this pillar (from a Sanity lookup, so it holds across cron runs/days).
  // Fall back to the top result (still better than nothing) if every
  // candidate is already used.
  const photo = data.photos?.find(
    (p) => !usedPexelsIds.has(String(p.id)) && !excludeIds?.has(String(p.id))
  ) ?? data.photos?.[0];
  if (!photo) {
    console.warn("[image-generator] Pexels returned no results");
    return null;
  }
  usedPexelsIds.add(String(photo.id));

  const imgRes = await fetch(photo.src.large2x);
  if (!imgRes.ok) {
    console.warn(`[image-generator] Failed to fetch Pexels image: ${imgRes.status}`);
    return null;
  }

  return {
    buffer:           Buffer.from(await imgRes.arrayBuffer()),
    photographerName: photo.photographer,
    photographerUrl:  photo.photographer_url,
    pexelsPageUrl:    photo.url,
  };
}

// ── 2. Upload to Cloudinary ───────────────────────────────────────────────────

export async function uploadToCloudinary(
  imageBuffer: Buffer,
  articleSlug: string,
  pillar: string
): Promise<CloudinaryResult> {
  const publicId = `${articleSlug}-${Date.now()}`;

  const result = await new Promise<{ public_id: string; secure_url: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder:         `boardroom-brief/${pillar}`,
          public_id:      publicId,
          transformation: [{ width: 1920, height: 1080, crop: "fill" }],
        },
        (err, res) => {
          if (err || !res) reject(err ?? new Error("Cloudinary upload returned no result"));
          else resolve(res);
        }
      );
      stream.end(imageBuffer);
    }
  );

  return buildCloudinaryUrls(result.public_id, result.secure_url);
}

// ── 3. Build Cloudinary URL variants ─────────────────────────────────────────

function buildCloudinaryUrls(publicId: string, secureUrl: string): CloudinaryResult {
  const base = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;
  return {
    publicId,
    url:          secureUrl,
    heroUrl:      `${base}/c_fill,w_1200,h_630/${publicId}`,
    thumbnailUrl: `${base}/c_fill,w_400,h_267/${publicId}`,
    ogImageUrl:   `${base}/c_fill,w_1200,h_630,q_auto,f_auto/${publicId}`,
    mobileUrl:    `${base}/c_fill,w_800,h_450/${publicId}`,
  };
}

// ── 4. Master function — never returns null ───────────────────────────────────

export async function generateArticleImage(
  draft: ArticleDraft,
  excludePexelsIds?: Set<string>
): Promise<ArticleImageResult> {
  const startedAt = Date.now();

  const slug = draft.headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  // ── a. Try Pexels ─────────────────────────────────────────────────────────────
  try {
    console.log("[image-generator] Trying Pexels…");
    const pexels = await fetchPexelsImage(draft.tags ?? [], draft.pillar, excludePexelsIds);
    if (pexels) {
      const cloudinary = await uploadToCloudinary(pexels.buffer, slug, draft.pillar);
      console.log("[image-generator] Pexels succeeded.");
      return {
        ...cloudinary,
        source:           "pexels",
        photographerName: pexels.photographerName,
        photographerUrl:  pexels.photographerUrl,
        pexelsPageUrl:    pexels.pexelsPageUrl,
        durationMs:       Date.now() - startedAt,
      };
    }
  } catch (err) {
    console.warn("[image-generator] Pexels failed:", (err as Error).message);
  }

  // ── b. Pillar default — always succeeds ─────────────────────────────────────
  console.warn(`[image-generator] Using pillar default for "${draft.pillar}"`);
  const defaultId = PILLAR_DEFAULT_IDS[draft.pillar]
    ?? PILLAR_DEFAULT_IDS["water-cooler"];

  const base = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;
  return {
    publicId:     defaultId,
    url:          `${base}/${defaultId}`,
    heroUrl:      `${base}/c_fill,w_1200,h_630/${defaultId}`,
    thumbnailUrl: `${base}/c_fill,w_400,h_267/${defaultId}`,
    ogImageUrl:   `${base}/c_fill,w_1200,h_630,q_auto,f_auto/${defaultId}`,
    mobileUrl:    `${base}/c_fill,w_800,h_450/${defaultId}`,
    source:       "pillar-default",
    durationMs:   Date.now() - startedAt,
  };
}
