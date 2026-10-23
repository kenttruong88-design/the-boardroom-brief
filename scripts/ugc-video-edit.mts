#!/usr/bin/env -S npx tsx
/**
 * ugc-video-edit.mts
 * ───────────────────
 * Re-renders an already generated clip with a video-to-video edit model
 * (default google/gemini-omni-flash-11, "edit" mode): the clip goes in as
 * video_id, so its motion, timing and framing are kept, while the prompt and
 * reference images steer how it's re-rendered (e.g. more photoreal, eyes open).
 *
 * Spends Hedra credits (Gemini Omni 1.1 Flash: 34/s at 720p, x1.5 at 1080p).
 * Input clips must be 1–10.15 s.
 *
 * Usage (from project root):
 *   npx tsx scripts/ugc-video-edit.mts <clip-asset-id> <prompt.txt> [ref1,ref2,...] [--model <slug>] [--resolution 720p]
 *
 * The public API refuses video uploads, so <clip-asset-id> is the Hedra video
 * asset of a clip Hedra itself generated (GET /assets?type=video lists them).
 * refs are local image paths or existing Hedra image asset ids.
 * Requires HEDRA_API_KEY and CLOUDINARY_* in .env.local.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");

function loadEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv(resolve(ROOT, ".env.local"));

const flag = (name: string) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
};
const modelSlug  = flag("--model") ?? "google/gemini-omni-flash-11";
const resolution = flag("--resolution") ?? "720p";
const [clipId, promptPath, refsArg] = process.argv.slice(2)
  .filter((a, i, all) => !a.startsWith("--") && !all[i - 1]?.startsWith("--"));
if (!clipId || !promptPath) {
  console.error("Usage: npx tsx scripts/ugc-video-edit.mts <clip-asset-id> <prompt.txt> [ref1,ref2,...] [--model <slug>] [--resolution 720p]");
  process.exit(1);
}

const { uploadLocalImageAsset, getGenerationStatus } = await import("../app/lib/social/hedra-client");
const { v2: cloudinary } = await import("cloudinary");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const BASE    = "https://api.hedra.com/web-app/public";
const headers = { "X-API-Key": process.env.HEDRA_API_KEY! };
const sleep   = (ms: number) => new Promise((r) => setTimeout(r, ms));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refIds: string[] = [];
for (const r of (refsArg ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
  refIds.push(UUID.test(r) ? r : await uploadLocalImageAsset(readFileSync(resolve(ROOT, r)), basename(r)));
}
const videoId = clipId;
console.log("Clip:", videoId, "| refs:", refIds.join(", ") || "none");

// Hedra measures the uploaded video asynchronously; wait for its duration.
let durationMs = 0;
for (let i = 0; i < 15 && !durationMs; i++) {
  const res = await fetch(`${BASE}/assets?type=video&ids=${videoId}`, { headers });
  const [asset] = await res.json() as Array<{ asset?: { duration_ms?: number } }>;
  durationMs = asset?.asset?.duration_ms ?? 0;
  if (!durationMs) await sleep(2000);
}
console.log(`Clip duration: ${durationMs || "unknown"}ms`);

const res = await fetch(`${BASE}/generations`, {
  method: "POST", headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    type:                "video",
    model_slug:          modelSlug,
    video_id:            videoId,
    reference_image_ids: refIds.length ? refIds : undefined,
    generated_video_inputs: {
      text_prompt:  readFileSync(resolve(ROOT, promptPath), "utf8").trim(),
      aspect_ratio: "9:16",
      resolution,
      ...(durationMs ? { duration_ms: Math.min(10000, Math.ceil(durationMs / 1000) * 1000) } : {}),
    },
  }),
});
const gen = await res.json() as { id?: string };
if (!gen.id) throw new Error(`Submit failed (${res.status}): ${JSON.stringify(gen)}`);
console.log("Edit submitted:", gen.id);

for (let i = 0; i < 120; i++) {
  await sleep(5000);
  const status = await getGenerationStatus(gen.id);
  console.log(`[${i + 1}] ${status.status} ${Math.round((status.progress ?? 0) * 100)}%`);
  if (status.status === "error") throw new Error(status.error_message ?? "Hedra video edit failed");
  if (status.status === "complete") {
    const rawUrl = status.url ?? status.download_url;
    if (!rawUrl) throw new Error("Hedra reported complete but returned no video URL");
    const upload = await cloudinary.uploader.upload(rawUrl, {
      resource_type: "video",
      folder:        "boardroom-brief/ugc-test",
      public_id:     `edit-${clipId.slice(0, 8)}-${Date.now()}`,
    });
    console.log("DONE:", upload.secure_url);
    process.exit(0);
  }
}
throw new Error("Timed out waiting for the edit");
