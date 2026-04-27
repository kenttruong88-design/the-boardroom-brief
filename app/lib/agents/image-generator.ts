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
}

export interface ArticleImageResult extends CloudinaryResult {
  generatedWith:   "flux-schnell" | "unsplash";
  generatedPrompt: string;
  durationMs:      number;
}

// ── 1. Flux Schnell via Replicate ─────────────────────────────────────────────

export async function generateWithFlux(prompt: string): Promise<Buffer> {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  const timeoutMs = 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
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

    // output is an array of FileOutput objects
    const outputs = output as { url: () => URL }[];
    if (!outputs || outputs.length === 0) {
      throw new Error("Flux returned no outputs");
    }

    const imageUrl = outputs[0].url().toString();
    const res = await fetch(imageUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch Flux image: ${res.status}`);

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timer);
  }
}

// ── 2. Unsplash fallback ──────────────────────────────────────────────────────

export async function fetchUnsplashImage(
  keywords: string[],
  countries: string[]
): Promise<Buffer> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error("UNSPLASH_ACCESS_KEY not set");

  const queryParts = [...keywords.slice(0, 3)];
  if (countries.length > 0) queryParts.push(countries[0]);
  const q = encodeURIComponent(queryParts.join(" "));

  const searchRes = await fetch(
    `https://api.unsplash.com/search/photos?query=${q}&orientation=landscape&per_page=5`,
    { headers: { Authorization: `Client-ID ${key}` } }
  );

  if (!searchRes.ok) {
    throw new Error(`Unsplash search failed: ${searchRes.status}`);
  }

  const data = await searchRes.json() as {
    results: Array<{ urls: { regular: string }; width: number; height: number }>;
  };

  const photo = data.results.find((r) => r.width > r.height) ?? data.results[0];
  if (!photo) throw new Error("Unsplash returned no results");

  const imgRes = await fetch(photo.urls.regular);
  if (!imgRes.ok) throw new Error(`Failed to fetch Unsplash image: ${imgRes.status}`);

  const arrayBuffer = await imgRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

  const base = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;
  const id = result.public_id;

  return {
    publicId:     id,
    url:          result.secure_url,
    heroUrl:      `${base}/c_fill,w_1200,h_630/${id}`,
    thumbnailUrl: `${base}/c_fill,w_400,h_267/${id}`,
    ogImageUrl:   `${base}/c_fill,w_1200,h_630,q_auto,f_auto/${id}`,
  };
}

// ── 4. Master function ────────────────────────────────────────────────────────

export async function generateArticleImage(
  draft: ArticleDraft
): Promise<ArticleImageResult | null> {
  const startedAt = Date.now();

  try {
    const prompt = await generateImagePrompt(draft);
    console.log(`[image-generator] Prompt: "${prompt.slice(0, 80)}…"`);

    const slug = draft.headline
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64);

    let imageBuffer: Buffer | null = null;
    let source: "flux-schnell" | "unsplash" = "flux-schnell";

    // Try Flux first
    try {
      console.log("[image-generator] Trying Flux Schnell…");
      imageBuffer = await generateWithFlux(prompt);
      console.log("[image-generator] Flux succeeded.");
    } catch (fluxErr) {
      console.warn(
        "[image-generator] Flux failed, falling back to Unsplash:",
        (fluxErr as Error).message
      );
      source = "unsplash";

      try {
        imageBuffer = await fetchUnsplashImage(draft.tags ?? [], draft.countries ?? []);
        console.log("[image-generator] Unsplash fallback succeeded.");
      } catch (unsplashErr) {
        console.warn(
          "[image-generator] Unsplash fallback also failed:",
          (unsplashErr as Error).message
        );
      }
    }

    if (!imageBuffer) {
      console.warn("[image-generator] Both sources failed — article will publish without image.");
      return null;
    }

    const cloudinary = await uploadToCloudinary(imageBuffer, slug, draft.pillar);
    console.log(`[image-generator] Uploaded to Cloudinary: ${cloudinary.publicId}`);

    return {
      ...cloudinary,
      generatedWith:   source,
      generatedPrompt: prompt,
      durationMs:      Date.now() - startedAt,
    };
  } catch (err) {
    console.error("[image-generator] Unexpected error:", (err as Error).message);
    return null;
  }
}
