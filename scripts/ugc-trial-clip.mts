#!/usr/bin/env -S npx tsx
/**
 * ugc-trial-clip.mts
 * ────────────────────
 * Generates ONE avatar clip from narration you already have (e.g. a voice
 * sample, or audio from a voice outside Hedra's library), so a new
 * persona/voice can be judged on a single clip before a full pipeline run.
 *
 * Uploads the audio (and optionally a start-frame image) to Hedra — uploads
 * are free — then submits one avatar video, which DOES spend Hedra credits.
 *
 * Usage (from project root):
 *   npx tsx scripts/ugc-trial-clip.mts <persona> <label> <audio.mp3> [start-frame.png]
 *   label: hook | country_a_dos | country_a_donts | country_b_dos | country_b_donts
 *
 * Without a start-frame image the persona's introSceneImageAssetId is used
 * (the fixed office backdrop the hook clip always opens on).
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

// --model <slug> tries another Hedra avatar model (e.g. together/hedra-avatar)
// instead of the pipeline's Character-3. --resolution 720p renders cheaper
// trials (default 1080p). --pad <ms> is the silence after the narration
// (default 800); 500 keeps a hook under the 10 s limit of video-edit models.
const flag = (name: string) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
};
const modelSlug  = flag("--model");
const resolution = flag("--resolution");
const padMs      = Number(flag("--pad") ?? 800);
const [personaKey, label, audioPath, imagePath] = process.argv.slice(2)
  .filter((a, i, all) => !a.startsWith("--") && !all[i - 1]?.startsWith("--"));
const VALID_LABELS = ["hook", "country_a_dos", "country_a_donts", "country_b_dos", "country_b_donts"];
if (!personaKey || !label || !audioPath || !VALID_LABELS.includes(label)) {
  console.error("Usage: npx tsx scripts/ugc-trial-clip.mts <persona> <label> <audio.mp3> [start-frame.png]");
  console.error(`Labels: ${VALID_LABELS.join(", ")}`);
  process.exit(1);
}

const { getCreatorPersona } = await import("../app/lib/social/creator-personas");
const { performancePromptFor } = await import("../app/lib/social/ugc-video-generator");
const {
  uploadLocalAudioAsset,
  uploadLocalImageAsset,
  getAudioAssetDurationMs,
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

let startFrameId: string;
if (imagePath) {
  startFrameId = await uploadLocalImageAsset(readFileSync(resolve(ROOT, imagePath)), basename(imagePath));
  console.log("Start frame uploaded:", startFrameId);
} else {
  if (!persona.introSceneImageAssetId) throw new Error(`Persona "${personaKey}" has no introSceneImageAssetId — pass a start-frame image`);
  startFrameId = persona.introSceneImageAssetId;
  console.log("Start frame: persona intro backdrop", startFrameId);
}

const audioId = await uploadLocalAudioAsset(readFileSync(resolve(ROOT, audioPath)), basename(audioPath));
console.log("Audio uploaded:", audioId);

// Hedra measures the uploaded audio asynchronously — retry briefly until
// the duration is available rather than failing on the first lookup.
let durationMs = 0;
for (let i = 0; i < 10 && !durationMs; i++) {
  try {
    durationMs = await getAudioAssetDurationMs(audioId);
  } catch {
    await sleep(2000);
  }
}
if (!durationMs) throw new Error("Hedra never reported a duration for the uploaded audio");
console.log(`Audio duration: ${durationMs}ms`);

const generationId = await submitAvatarVideo({
  startKeyframeId:   startFrameId,
  audioAssetId:      audioId,
  performancePrompt: performancePromptFor(persona.name, label as Parameters<typeof performancePromptFor>[1], persona.performanceNote, persona.handsDirection),
  durationMs:        durationMs + padMs,
  modelSlug,
  resolution,
});
console.log("Video submitted:", generationId);

for (let i = 0; i < 80; i++) {
  await sleep(5000);
  const status = await getGenerationStatus(generationId);
  console.log(`[${i + 1}] ${status.status} ${Math.round((status.progress ?? 0) * 100)}%`);
  if (status.status === "error") throw new Error(status.error_message ?? "Hedra video generation failed");
  if (status.status === "complete") {
    const rawUrl = status.url ?? status.download_url;
    if (!rawUrl) throw new Error("Hedra reported complete but returned no video URL");
    const upload = await cloudinary.uploader.upload(rawUrl, {
      resource_type: "video",
      folder:        "boardroom-brief/ugc-test",
      public_id:      `trial-${personaKey}-${label}-${Date.now()}`,
    });
    console.log("DONE:", upload.secure_url);
    process.exit(0);
  }
}
throw new Error("Timed out waiting for the video");
