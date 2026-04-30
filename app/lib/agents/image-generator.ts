import Replicate from "replicate";
import { v2 as cloudinary } from "cloudinary";
import { generateImagePrompt } from "./image-prompt-generator";
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
  source:           "flux-schnell" | "pexels" | "pillar-default";
  generatedPrompt?: string;
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
};

const PILLAR_DEFAULT_IDS: Record<string, string> = {
  "markets-floor":  "boardroom-brief/defaults/markets-floor-default",
  "macro-mondays":  "boardroom-brief/defaults/macro-mondays-default",
  "c-suite-circus": "boardroom-brief/defaults/c-suite-circus-default",
  "global-office":  "boardroom-brief/defaults/global-office-default",
  "water-cooler":   "boardroom-brief/defaults/water-cooler-default",
};

// ── 1. Flux Schnell via Replicate ─────────────────────────────────────────────

export async function generateWithFlux(prompt: string): Promise<Buffer> {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  const output = await replicate.run(
    "black-forest-labs/flux-schnell",
    {
      input: {
        prompt,
        num_outputs:    1,
        aspect_ratio:   "16:9",
        output_format:  "webp",
        output_quality: 80,
      },
    }
  );

  // Replicate SDK returns either FileOutput[] (new) or plain objects with .url() (old)
  const outputs = output as unknown[];
  if (!outputs || outputs.length === 0) throw new Error("Flux returned no outputs");

  const first = outputs[0];
  let imageUrl: string;
  if (typeof first === "string") {
    imageUrl = first;
  } else if (first && typeof (first as { url: unknown }).url === "function") {
    imageUrl = (first as { url: () => URL }).url().toString();
  } else if (first && typeof (first as { url: unknown }).url === "string") {
    imageUrl = (first as { url: string }).url;
  } else {
    throw new Error(`Unexpected Flux output shape: ${JSON.stringify(first)}`);
  }

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch Flux image: ${res.status}`);

  return Buffer.from(await res.arrayBuffer());
}

// ── 2. Pexels fallback ────────────────────────────────────────────────────────

export async function fetchPexelsImage(
  keywords: string[],
  pillar: string
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
    `https://api.pexels.com/v1/search?query=${q}&orientation=landscape&per_page=5&size=large`,
    { headers: { Authorization: key } }
  );

  if (!searchRes.ok) {
    console.warn(`[image-generator] Pexels search failed: ${searchRes.status}`);
    return null;
  }

  const data = await searchRes.json() as {
    photos: Array<{
      src: { large2x: string };
      photographer: string;
      photographer_url: string;
      url: string;
    }>;
  };

  const photo = data.photos?.[0];
  if (!photo) {
    console.warn("[image-generator] Pexels returned no results");
    return null;
  }

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

// ── 3. Upload to Cloudinary ───────────────────────────────────────────────────

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

// ── 4. Build Cloudinary URL variants ─────────────────────────────────────────

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

// ── 5. Master function — never returns null ───────────────────────────────────

export async function generateArticleImage(
  draft: ArticleDraft
): Promise<ArticleImageResult> {
  const startedAt = Date.now();

  const slug = draft.headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  // ── a. Generate prompt ───────────────────────────────────────────────────────
  let prompt = "";
  try {
    prompt = await generateImagePrompt(draft);
    console.log(`[image-generator] Prompt: "${prompt.slice(0, 80)}…"`);
  } catch (err) {
    console.warn("[image-generator] Prompt generation failed:", (err as Error).message);
  }

  // ── b. Try Flux Schnell ──────────────────────────────────────────────────────
  if (prompt) {
    try {
      console.log("[image-generator] Trying Flux Schnell…");
      const buffer = await generateWithFlux(prompt);
      const cloudinary = await uploadToCloudinary(buffer, slug, draft.pillar);
      console.log("[image-generator] Flux succeeded.");
      return {
        ...cloudinary,
        source:          "flux-schnell",
        generatedPrompt: prompt,
        durationMs:      Date.now() - startedAt,
      };
    } catch (err) {
      console.warn("[image-generator] Flux failed:", (err as Error).message);
    }
  }

  // ── c. Try Pexels fallback ───────────────────────────────────────────────────
  try {
    console.log("[image-generator] Trying Pexels fallback…");
    const pexels = await fetchPexelsImage(draft.tags ?? [], draft.pillar);
    if (pexels) {
      const cloudinary = await uploadToCloudinary(pexels.buffer, slug, draft.pillar);
      console.log("[image-generator] Pexels fallback succeeded.");
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
    console.warn("[image-generator] Pexels fallback failed:", (err as Error).message);
  }

  // ── d. Pillar default — always succeeds ─────────────────────────────────────
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
