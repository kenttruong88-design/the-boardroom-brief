#!/usr/bin/env -S npx tsx
/**
 * ugc-test-clips.mts
 * ────────────────────
 * Cheap iteration tool for dialing in scene/performance prompts: writes the
 * full 5-clip script (Claude only, no Hedra cost) but only submits Hedra
 * generations (scene image + narration + avatar video) for the clip labels
 * you name — so framing/pose/performance changes can be judged on 1-2 clips
 * instead of spending credits on all 5 every iteration. Once a prompt is
 * settled, use the real ugc-draft/ugc-approve pipeline for production runs.
 *
 * Usage (from project root):
 *   npx tsx scripts/ugc-test-clips.mts <path-to-out-of-office-md> <label> [label2 ...]
 *   labels: hook | country_a_dos | country_a_donts | country_b_dos | country_b_donts
 *
 * Requires ANTHROPIC_API_KEY, HEDRA_API_KEY, and CLOUDINARY_* in .env.local.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
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

const file = process.argv[2];
const requestedLabels = process.argv.slice(3);
const VALID_LABELS = ["hook", "country_a_dos", "country_a_donts", "country_b_dos", "country_b_donts"];

if (!file || requestedLabels.length === 0) {
  console.error("Usage: npx tsx scripts/ugc-test-clips.mts <path-to-out-of-office-md> <label> [label2 ...]");
  console.error(`Labels: ${VALID_LABELS.join(", ")}`);
  process.exit(1);
}
for (const label of requestedLabels) {
  if (!VALID_LABELS.includes(label)) {
    console.error(`Unknown label "${label}". Valid: ${VALID_LABELS.join(", ")}`);
    process.exit(1);
  }
}

const { parseOutOfOfficeArticle } = await import("../app/lib/social/out-of-office-parser");
const { writeUgcScript }          = await import("../app/lib/social/ugc-script-writer");
const { getCreatorPersona, getPersonaIdentityAssetId } = await import("../app/lib/social/creator-personas");
const { performancePromptFor } = await import("../app/lib/social/ugc-video-generator");
const {
  generateNarration,
  submitAvatarVideo,
  getGenerationStatus,
  generateSceneImage,
} = await import("../app/lib/social/hedra-client");
const { v2: cloudinary } = await import("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type ClipLabel = "hook" | "country_a_dos" | "country_a_donts" | "country_b_dos" | "country_b_donts";

async function main() {
  const markdown = readFileSync(resolve(ROOT, file), "utf8");
  const parsed   = parseOutOfOfficeArticle(markdown);
  const persona  = getCreatorPersona("suki");
  const runId    = Date.now();

  console.log("Headline:", parsed.headline);
  console.log("Writing 5-clip script with Claude (only submitting Hedra for:", requestedLabels.join(", "), ")...");
  const s = await writeUgcScript({ parsed, persona });

  const allClips: Record<ClipLabel, { script: string; scene?: string }> = {
    hook:            { script: s.hookClip },
    country_a_dos:   { script: s.countryADosClip,   scene: s.countryADosScene },
    country_a_donts: { script: s.countryADontsClip, scene: s.countryADontsScene },
    country_b_dos:   { script: s.countryBDosClip,   scene: s.countryBDosScene },
    country_b_donts: { script: s.countryBDontsClip, scene: s.countryBDontsScene },
  };

  const identityAssetId = await getPersonaIdentityAssetId(persona);
  console.log("Identity asset id:", identityAssetId);

  for (const label of requestedLabels as ClipLabel[]) {
    const clip = allClips[label];
    console.log(`\n[${label}] script: ${clip.script}`);

    let sceneAssetId: string;
    if (label === "hook") {
      if (!persona.introSceneImageAssetId) throw new Error(`Persona "${persona.key}" has no introSceneImageAssetId set`);
      sceneAssetId = persona.introSceneImageAssetId;
      console.log(`[${label}] using fixed backdrop asset: ${sceneAssetId}`);
    } else {
      console.log(`[${label}] scene: ${clip.scene}`);
      sceneAssetId = await generateSceneImage(
        identityAssetId,
        clip.scene!,
        `${persona.key}-test-${label}-scene.png`
      );
      console.log(`[${label}] scene asset: ${sceneAssetId}`);
    }

    const narration = await generateNarration(clip.script, persona.voiceId);
    console.log(`[${label}] narration ready: ${narration.durationMs}ms`);

    const generationId = await submitAvatarVideo({
      startKeyframeId:   sceneAssetId,
      audioAssetId:      narration.assetId,
      performancePrompt: performancePromptFor(persona.name, label),
      durationMs:        narration.durationMs + 800,
    });
    console.log(`[${label}] video generation submitted: ${generationId}`);
    console.log(`[${label}] polling...`);

    let uploaded = false;
    for (let i = 0; i < 80 && !uploaded; i++) {
      await sleep(5000);
      const status = await getGenerationStatus(generationId);
      console.log(`[${label}] [${i + 1}] status: ${status.status}  progress: ${Math.round((status.progress ?? 0) * 100)}%`);
      if (status.status === "complete") {
        const rawUrl = status.url ?? status.download_url;
        if (!rawUrl) {
          console.error(`[${label}] complete but no video URL`);
          break;
        }
        const upload = await cloudinary.uploader.upload(rawUrl, {
          resource_type: "video",
          folder:        "boardroom-brief/ugc-test",
          public_id:      `ugc-test-${runId}-${label}`,
        });
        console.log(`[${label}] DONE: ${upload.secure_url}`);
        uploaded = true;
      } else if (status.status === "error") {
        console.error(`[${label}] FAILED: ${status.error_message}`);
        break;
      }
    }
    if (!uploaded) console.error(`[${label}] did not complete (timeout or error) — see above`);
  }
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
