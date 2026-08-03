// Thin wrapper around Hedra's public REST API (api.hedra.com/web-app/public).
//
// NOTE 1: passing `audio_generation` (nested TTS-in-video) to POST /generations
// reliably 400s with "model missing not valid for generation type
// text_to_speech" — looks like a backend bug in that code path. The reliable
// sequence, used throughout this file, is:
//   1. Generate narration as its own standalone text_to_speech generation.
//   2. Poll it to completion to get an audio asset id.
//   3. Submit the avatar video generation with that asset id as `audio_id`
//      (NOT the nested `audio_generation` field).
//
// NOTE 2: together/hedra-character-3 (and hedra-avatar/hedra-omnia) reliably
// errored with a generic "UNAVAILABLE: an unknown error occurred" for an
// entire day of testing — across every duration (8s/10s/30s), with both a
// raw `start_keyframe_url` and a properly uploaded `start_keyframe_id`. The
// fix: explicitly pass a `resolution` value in generated_video_inputs.
// Leaving resolution unset (the default/"auto" path) is what was failing —
// confirmed BOTH "480p" and "720p" succeed once set explicitly, so the bug
// is specifically in the unset/auto resolution-selection path, not tied to
// any particular quality tier. Defaulting to "720p" here since that's the
// minimum acceptable quality for published clips. Uploading the reference
// image as a real asset first (rather than a raw URL) is also kept as the
// standard path.
//
// NOTE 3: video duration_ms must be driven by the ACTUAL narration audio
// length, not a fixed guess — a script that reads a couple words over budget
// produces audio longer than the video, and Hedra just cuts the video off
// mid-sentence rather than stretching to fit. together/hedra-character-3
// accepts any duration_ms up to 600000 (confirmed via a deliberately invalid
// value's error message) with no discrete-step restriction, so there's no
// reason not to size it exactly to the audio. byteplus/seedance-20 (used for
// transition/bridge clips) DOES require discrete 1000ms steps between 4000
// and 15000 (confirmed via its own validation error) — bridge clips don't
// carry narration, so this doesn't need the same dynamic sizing.

const BASE = "https://api.hedra.com/web-app/public";

function headers(): HeadersInit {
  const apiKey = process.env.HEDRA_API_KEY;
  if (!apiKey) throw new Error("HEDRA_API_KEY not set");
  return { "X-API-Key": apiKey, "Content-Type": "application/json" };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  "POST",
    headers: headers(),
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface HedraGenerationStatus {
  id:            string;
  asset_id?:     string;
  type:          string;
  status:        "queued" | "processing" | "finalizing" | "complete" | "error";
  progress:      number;
  url?:          string;
  download_url?: string;
  error_message?: string;
}

export interface AvatarVideoParams {
  startKeyframeId:   string;
  audioAssetId:      string;
  performancePrompt: string;
  modelSlug?:         string;
  aspectRatio?:       "9:16" | "16:9" | "1:1";
  durationMs?:        number;
  resolution?:        string;
}

// ── 0. Image assets ───────────────────────────────────────────────────────────

/** Downloads an image and uploads it as a Hedra asset, returning its asset id. */
export async function uploadImageAsset(imageUrl: string, name: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download reference image: ${imgRes.status}`);
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());

  const created = await post<{ id: string }>("/assets", { name, type: "image" });
  if (!created.id) throw new Error(`No asset id returned for image upload: ${JSON.stringify(created)}`);

  const form = new FormData();
  form.append("file", new Blob([imgBuf]), name);
  const uploadRes = await fetch(`${BASE}/assets/${created.id}/upload`, {
    method: "POST",
    headers: { "X-API-Key": process.env.HEDRA_API_KEY! },
    body: form,
  });
  if (!uploadRes.ok) throw new Error(`Image asset upload failed: ${uploadRes.status} ${await uploadRes.text()}`);

  return created.id;
}

/**
 * Generates a new pose/scene for a reference identity via image-to-image
 * (flux-kontext-pro preserves face + outfit well in testing), and returns the
 * resulting image asset id — usable directly as a video's start_keyframe_id.
 */
export async function generateSceneImage(
  referenceAssetId: string,
  prompt: string,
  name: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<string> {
  const gen = await post<{ id: string; asset_id: string }>("/generations", {
    type:                 "image_to_image",
    model_slug:           "fal/flux-kontext-pro-i2i",
    reference_image_ids:  [referenceAssetId],
    text_prompt:          prompt,
    aspect_ratio:         "9:16",
    name,
  });
  if (!gen.id) throw new Error(`No generation id returned for scene image: ${JSON.stringify(gen)}`);
  const status = await pollUntilDone(gen.id, opts);
  if (status.status !== "complete" || !status.asset_id) {
    throw new Error(`Scene image generation failed: ${status.error_message ?? "unknown error"}`);
  }
  return status.asset_id;
}

// ── 1. Narration (text-to-speech) ────────────────────────────────────────────

/** Submits a standalone TTS generation. Does not wait for completion. */
export async function submitNarration(text: string, voiceId: string): Promise<string> {
  const gen = await post<{ id: string }>("/generations", {
    type: "text_to_speech",
    voice_id: voiceId,
    text,
  });
  if (!gen.id) throw new Error(`No generation id returned for narration: ${JSON.stringify(gen)}`);
  return gen.id;
}

/**
 * Looks up an audio asset's actual rendered duration — the /generations
 * status endpoint doesn't return this for text_to_speech, only /assets does.
 */
export async function getAudioAssetDurationMs(assetId: string): Promise<number> {
  const assets = await get<Array<{ asset?: { duration_ms?: number } }>>(`/assets?type=audio&ids=${assetId}`);
  const durationMs = assets[0]?.asset?.duration_ms;
  if (durationMs === undefined) throw new Error(`No duration_ms found for audio asset ${assetId}`);
  return durationMs;
}

/** Submits narration and polls until the audio asset is ready. */
export async function generateNarration(
  text: string,
  voiceId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<{ assetId: string; audioUrl: string; durationMs: number }> {
  const generationId = await submitNarration(text, voiceId);
  const status = await pollUntilDone(generationId, opts);
  if (status.status !== "complete" || !status.asset_id) {
    throw new Error(`Narration failed: ${status.error_message ?? "unknown error"}`);
  }
  const durationMs = await getAudioAssetDurationMs(status.asset_id);
  return { assetId: status.asset_id, audioUrl: status.url ?? status.download_url ?? "", durationMs };
}

// ── 2. Avatar video ───────────────────────────────────────────────────────────
// Default lip-synced avatar model for the whole UGC pipeline. Swapping this
// one constant (or passing AvatarVideoParams.modelSlug per call) is the only
// change needed to try a different model — every call site (outro-clip.ts,
// ugc-video-generator.ts, test-ugc-video.mts) inherits it via this default.
//
// Tried fal/kling-ai-avatar-v2-standard (11 credits/sec, premium) as an
// alternative — rejected: lip-sync was visibly worse than Character-3's,
// despite costing ~57% more per second. Back on Hedra's own model.
export const AVATAR_MODEL_SLUG = "together/hedra-character-3";

/** Submits an avatar (lip-synced) video generation. Does not wait for completion. */
export async function submitAvatarVideo(params: AvatarVideoParams): Promise<string> {
  const gen = await post<{ id: string }>("/generations", {
    type:              "video",
    model_slug:        params.modelSlug ?? AVATAR_MODEL_SLUG,
    start_keyframe_id: params.startKeyframeId,
    audio_id:          params.audioAssetId,
    generated_video_inputs: {
      text_prompt:  params.performancePrompt,
      aspect_ratio: params.aspectRatio ?? "9:16",
      duration_ms:  params.durationMs ?? 8000,
      // 1080p over 720p only costs 25% more (vs 720p's own 2.5x premium over
      // 540p) and visibly sharpened mouth detail in a side-by-side test —
      // confirmed worth the small cost bump.
      resolution:   params.resolution ?? "1080p",
    },
  });
  if (!gen.id) throw new Error(`No generation id returned for avatar video: ${JSON.stringify(gen)}`);
  return gen.id;
}

// ── 2b. Transition (bridge) clip ──────────────────────────────────────────────
// Morphs between two still images (no audio) — mirrors Hedra's own web-app
// "Övergång" tool. Useful as a short bridge clip stitched between two talking
// clips whose scenes don't otherwise connect. byteplus/seedance-20 rejects
// durations under 4000ms.

export interface TransitionClipParams {
  startKeyframeId: string;
  endKeyframeId:   string;
  prompt:          string;
  modelSlug?:       string;
  aspectRatio?:     "9:16" | "16:9" | "1:1";
  durationMs?:      number;
  resolution?:      string;
}

export async function submitTransitionClip(params: TransitionClipParams): Promise<string> {
  const gen = await post<{ id: string }>("/generations", {
    type:              "video",
    model_slug:        params.modelSlug ?? "byteplus/seedance-20",
    start_keyframe_id: params.startKeyframeId,
    end_keyframe_id:   params.endKeyframeId,
    generated_video_inputs: {
      text_prompt:  params.prompt,
      aspect_ratio: params.aspectRatio ?? "9:16",
      duration_ms:  params.durationMs ?? 4000,
      resolution:   params.resolution ?? "720p",
    },
  });
  if (!gen.id) throw new Error(`No generation id returned for transition clip: ${JSON.stringify(gen)}`);
  return gen.id;
}

// ── 3. Status polling ─────────────────────────────────────────────────────────

export async function getGenerationStatus(generationId: string): Promise<HedraGenerationStatus> {
  return get<HedraGenerationStatus>(`/generations/${generationId}/status`);
}

/**
 * Polls a generation until it reaches a terminal state (complete/error) or
 * the timeout elapses. Suitable for narration (~10-20s) inline; avatar video
 * (2-5 min) should generally be polled from a separate finalize step instead
 * of blocking a single request for its full duration.
 */
export async function pollUntilDone(
  generationId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<HedraGenerationStatus> {
  const intervalMs = opts.intervalMs ?? 3000;
  const timeoutMs  = opts.timeoutMs  ?? 120_000;
  const deadline   = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await getGenerationStatus(generationId);
    if (status.status === "complete" || status.status === "error") return status;
    await sleep(intervalMs);
  }
  throw new Error(`Generation ${generationId} timed out after ${timeoutMs}ms`);
}
