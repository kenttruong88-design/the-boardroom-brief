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
 *   npx tsx scripts/ugc-test-clips.mts <md> <label> [label2 ...] --stills-only
 *   ... --script-file <json>   reuse (or write and save) one script across runs
 *   labels: hook | country_a_dos | country_a_donts | country_b_dos | country_b_donts
 *
 * --stills-only generates just the scene start frames (one Hedra image each)
 * and skips narration + avatar video — the cheap way to check scene/outfit
 * prompts before paying for video.
 *
 * Requires ANTHROPIC_API_KEY, HEDRA_API_KEY, and CLOUDINARY_* in .env.local.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
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
const stillsOnly = process.argv.includes("--stills-only");
const sfIdx      = process.argv.indexOf("--script-file");
const scriptFile = sfIdx !== -1 ? process.argv[sfIdx + 1] : undefined;
const requestedLabels = process.argv.slice(3)
  .filter((a, i, all) => a !== "--stills-only" && a !== "--script-file" && all[i - 1] !== "--script-file");
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
const { getCreatorPersona, getPersonaIdentityAssetIds } = await import("../app/lib/social/creator-personas");
const { performancePromptFor, scenePromptFor, SCENE_RESOLUTION } = await import("../app/lib/social/ugc-video-generator");
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

// Saves a generated scene image to reference/ugc-test/ for review — Hedra's
// generation status has no download link for images, but /assets does.
async function saveStill(assetId: string, fileName: string) {
  const res = await fetch(`https://api.hedra.com/web-app/public/assets?type=image&ids=${assetId}`, {
    headers: { "X-API-Key": process.env.HEDRA_API_KEY ?? "" },
  });
  const [entry] = (await res.json()) as Array<{ asset?: { url?: string } }>;
  const url = entry?.asset?.url;
  if (!url) {
    console.error(`  could not find a download url for asset ${assetId}`);
    return;
  }
  const outDir = resolve(ROOT, "reference", "ugc-test");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, fileName), Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log(`  saved reference/ugc-test/${fileName}`);
}

type ClipLabel ="hook" | "country_a_dos" | "country_a_donts" | "country_b_dos" | "country_b_donts";

async function main() {
  const markdown = readFileSync(resolve(ROOT, file), "utf8");
  const parsed   = parseOutOfOfficeArticle(markdown);
  // Same folder → creator rule as ugc-draft.mts.
  const persona  = getCreatorPersona(file.replace(/\\/g, "/").includes("global-office/") ? "priya" : "suki");
  const runId    = Date.now();

  console.log("Headline:", parsed.headline);
  // --script-file <json>: reuse a saved script (so stills and videos come
  // from the same one), or write a fresh script and save it there.
  let s: Awaited<ReturnType<typeof writeUgcScript>>;
  if (scriptFile && existsSync(resolve(ROOT, scriptFile))) {
    s = JSON.parse(readFileSync(resolve(ROOT, scriptFile), "utf8"));
    console.log("Using saved script:", scriptFile);
  } else {
    console.log("Writing 5-clip script with Claude (only submitting Hedra for:", requestedLabels.join(", "), ")...");
    s = await writeUgcScript({ parsed, persona });
    if (scriptFile) {
      writeFileSync(resolve(ROOT, scriptFile), JSON.stringify(s, null, 2));
      console.log("Saved script:", scriptFile);
    }
  }

  const allClips: Record<ClipLabel, { script: string; scene?: string; outfit?: string }> = {
    hook:            { script: s.hookClip },
    country_a_dos:   { script: s.countryADosClip,   scene: s.countryADosScene,   outfit: s.countryADosOutfit },
    country_a_donts: { script: s.countryADontsClip, scene: s.countryADontsScene, outfit: s.countryADontsOutfit },
    country_b_dos:   { script: s.countryBDosClip,   scene: s.countryBDosScene,   outfit: s.countryBDosOutfit },
    country_b_donts: { script: s.countryBDontsClip, scene: s.countryBDontsScene, outfit: s.countryBDontsOutfit },
  };

  const identityAssetIds = await getPersonaIdentityAssetIds(persona);
  console.log("Identity asset ids:", identityAssetIds);

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
      console.log(`[${label}] outfit: ${clip.outfit}`);
      sceneAssetId = await generateSceneImage(
        identityAssetIds,
        scenePromptFor(clip.scene!, clip.outfit, persona.sceneNote),
        `${persona.key}-test-${label}-scene.png`,
        { resolution: SCENE_RESOLUTION }
      );
      console.log(`[${label}] scene asset: ${sceneAssetId}`);
    }
    if (stillsOnly) {
      if (label !== "hook") await saveStill(sceneAssetId, `${runId}-${label}.png`);
      continue;
    }

    const narration = await generateNarration(clip.script, persona.voiceId);
    console.log(`[${label}] narration ready: ${narration.durationMs}ms`);

    const generationId = await submitAvatarVideo({
      startKeyframeId:   sceneAssetId,
      audioAssetId:      narration.assetId,
      performancePrompt: performancePromptFor(persona.name, label, persona.performanceNote, persona.handsDirection),
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
