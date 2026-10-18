#!/usr/bin/env -S npx tsx
/**
 * ugc-trial-outro.mts
 * ────────────────────
 * Trials a persona's outro clip on one or more candidate backdrops before
 * one is chosen as introSceneImageAssetId. Narrates persona.outroScript ONCE
 * and reuses that audio for every backdrop so they differ only visually,
 * with the same performance prompt as app/lib/social/outro-clip.ts.
 *
 * Results go to boardroom-brief/ugc-test (not the persona's stable outro
 * slot). Each backdrop costs one avatar-video generation in Hedra credits.
 *
 * Usage (from project root):
 *   npx tsx scripts/ugc-trial-outro.mts <persona> [--voice <hedra-voice-uuid>] <label>=<backdrop.png> [<label>=<backdrop.png> ...]
 *
 * --voice trials a candidate voice without changing the persona's voiceId.
 * --prompt "<text>" trials a different performance prompt.
 *
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

const args = process.argv.slice(2);
const voiceFlag = args.findIndex((a) => a === "--voice");
const voiceOverride = voiceFlag >= 0 ? args.splice(voiceFlag, 2)[1] : undefined;
const promptFlag = args.findIndex((a) => a === "--prompt");
const promptOverride = promptFlag >= 0 ? args.splice(promptFlag, 2)[1] : undefined;
const [personaKey, ...pairs] = args;
const backdrops = pairs.map((p) => p.split("=")).filter((p) => p.length === 2 && p[0] && p[1]);
if (!personaKey || !backdrops.length || backdrops.length !== pairs.length) {
  console.error("Usage: npx tsx scripts/ugc-trial-outro.mts <persona> [--voice <hedra-voice-uuid>] <label>=<backdrop.png> [...]");
  process.exit(1);
}

const { getCreatorPersona } = await import("../app/lib/social/creator-personas");
const {
  generateNarration,
  uploadLocalImageAsset,
  submitAvatarVideo,
  getGenerationStatus,
} = await import("../app/lib/social/hedra-client");
const { v2: cloudinary } = await import("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const persona = getCreatorPersona(personaKey);
const voiceId = voiceOverride ?? persona.voiceId;
if (!voiceId) throw new Error(`Persona "${personaKey}" has no voiceId — pass --voice`);

const narration = await generateNarration(persona.outroScript, voiceId);
console.log(`Narration: ${narration.assetId} (${narration.durationMs}ms) ${narration.audioUrl}`);

async function trial(label: string, imagePath: string): Promise<string> {
  const frameId = await uploadLocalImageAsset(readFileSync(resolve(ROOT, imagePath)), basename(imagePath));
  const generationId = await submitAvatarVideo({
    startKeyframeId:   frameId,
    audioAssetId:      narration.assetId,
    performancePrompt: promptOverride ?? `${persona.name} speaking directly to camera, documentary travel vlog style, warm closing tone, natural hand gesture.`,
    durationMs:        narration.durationMs + 800,
  });
  console.log(`[${label}] frame ${frameId}, video submitted ${generationId}`);

  for (let i = 0; i < 80; i++) {
    await sleep(8000);
    const status = await getGenerationStatus(generationId);
    if (status.status === "error") throw new Error(`[${label}] ${status.error_message ?? "Hedra video generation failed"}`);
    if (status.status === "complete") {
      const rawUrl = status.url ?? status.download_url;
      if (!rawUrl) throw new Error(`[${label}] complete but no video URL`);
      const upload = await cloudinary.uploader.upload(rawUrl, {
        resource_type: "video",
        folder:        "boardroom-brief/ugc-test",
        public_id:     `trial-${personaKey}-outro-${label}-${Date.now()}`,
      });
      return upload.secure_url;
    }
  }
  throw new Error(`[${label}] timed out waiting for the video`);
}

const results = await Promise.allSettled(backdrops.map(([label, path]) => trial(label, path)));
results.forEach((r, i) => console.log(`${backdrops[i][0]}: ${r.status === "fulfilled" ? r.value : `FAILED ${r.reason}`}`));
