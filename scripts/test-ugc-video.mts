#!/usr/bin/env -S npx tsx
/**
 * test-ugc-video.mts
 * ────────────────────
 * Full end-to-end dry run of the Suki UGC pipeline against a real
 * content/out-of-office/*.md article:
 *   1. Parse the article, write the 5-clip script with Claude (hook, then
 *      each country's Do's and Don'ts as SEPARATE clips — split this way
 *      rather than one combined Do's+Don'ts clip per country because a
 *      direct comparison showed Character-3's lip-sync holds tight on short
 *      ~8-13s clips but visibly drifts on long ~25s ones).
 *   2. Generate a distinct start-frame image per clip via image-to-image
 *      (same identity, different pose/setting).
 *   3. Generate narration + avatar video per clip, in parallel.
 *   4. Generate 4 AI "bridge" transition clips (between each consecutive
 *      pair) via Hedra's Seedance-2.0 transition feature.
 *   4b. Reuse the persona's shared outro clip if already generated
 *      (persona.outroCloudinaryPublicId), or generate it once now.
 *   5. Upload everything to Cloudinary and produce TWO compiled videos for
 *      comparison: a simple hard-cut splice, and one with the AI bridges
 *      spliced in between — both ending with the shared outro clip.
 *
 * Bypasses Supabase (ugc_video_queue migration not applied yet) — this is
 * for validating the pipeline itself, not the approval workflow.
 *
 * Usage (from project root):
 *   npx tsx scripts/test-ugc-video.mts content/out-of-office/<file>.md
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
if (!file) {
  console.error("Usage: npx tsx scripts/test-ugc-video.mts <path-to-out-of-office-md>");
  process.exit(1);
}

// Dynamic imports so env vars are loaded before claude.ts / cloudinary.config()
// run at module scope.
const { parseOutOfOfficeArticle } = await import("../app/lib/social/out-of-office-parser");
const { writeUgcScript }          = await import("../app/lib/social/ugc-script-writer");
const { getCreatorPersona, getPersonaIdentityAssetId } = await import("../app/lib/social/creator-personas");
const { buildCaptionedVideoUrl, buildSplicedVideoUrl, performancePromptFor } =
  await import("../app/lib/social/ugc-video-generator");
const { generateOutroClip } = await import("../app/lib/social/outro-clip");
const {
  generateNarration,
  submitAvatarVideo,
  submitTransitionClip,
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

async function pollAndUpload(label: string, generationId: string, publicId: string) {
  for (let i = 0; i < 80; i++) {
    await sleep(5000);
    const status = await getGenerationStatus(generationId);
    console.log(`[${label}] [${i + 1}] status: ${status.status}  progress: ${Math.round((status.progress ?? 0) * 100)}%`);
    if (status.status === "complete") {
      const rawUrl = status.url ?? status.download_url;
      if (!rawUrl) return { label, error: "complete but no video URL" };
      console.log(`[${label}] Uploading to Cloudinary...`);
      const upload = await cloudinary.uploader.upload(rawUrl, {
        resource_type: "video",
        folder:        "boardroom-brief/ugc-test",
        public_id:      publicId,
      });
      console.log(`[${label}] Uploaded: ${upload.public_id}`);
      return { label, publicId: upload.public_id, secureUrl: upload.secure_url };
    }
    if (status.status === "error") {
      console.error(`[${label}] FAILED: ${status.error_message}`);
      return { label, error: status.error_message };
    }
  }
  return { label, error: "timeout" };
}

type ClipLabel = "hook" | "country_a_dos" | "country_a_donts" | "country_b_dos" | "country_b_donts";

interface Clip {
  label:     ClipLabel;
  script:    string;
  scene:     string;
  captions?: string[];
}

async function main() {
  const markdown = readFileSync(resolve(ROOT, file), "utf8");
  const parsed = parseOutOfOfficeArticle(markdown);
  console.log("Headline:", parsed.headline);
  console.log("Countries:", parsed.countries);

  const persona = getCreatorPersona("suki");
  const runId = Date.now();

  console.log("\n1. Writing 5-clip script with Claude (incl. per-clip scenes)...");
  const s = await writeUgcScript({ parsed, persona });

  const clips: Clip[] = [
    { label: "hook",            script: s.hookClip,            scene: s.hookScene },
    { label: "country_a_dos",   script: s.countryADosClip,     scene: s.countryADosScene,     captions: s.countryADosCaptions },
    { label: "country_a_donts", script: s.countryADontsClip,   scene: s.countryADontsScene,   captions: s.countryADontsCaptions },
    { label: "country_b_dos",   script: s.countryBDosClip,     scene: s.countryBDosScene,     captions: s.countryBDosCaptions },
    { label: "country_b_donts", script: s.countryBDontsClip,   scene: s.countryBDontsScene,   captions: s.countryBDontsCaptions },
  ];
  for (const clip of clips) {
    console.log(`   [${clip.label}]`, clip.script, "|", clip.scene);
    clip.captions?.forEach((item, i) => console.log(`     Caption ${i + 1}:`, item));
  }

  console.log("\n2. Resolving identity reference (character sheet if available)...");
  const identityAssetId = await getPersonaIdentityAssetId(persona);
  console.log("   Identity asset id:", identityAssetId);

  console.log("\n3. Generating a distinct start-frame scene image per clip...");
  const sceneAssetIds = await Promise.all(
    clips.map((clip) => generateSceneImage(identityAssetId, clip.scene, `${persona.key}-${clip.label}-scene.png`))
  );
  clips.forEach((clip, i) => console.log(`   [${clip.label}] scene asset: ${sceneAssetIds[i]}`));

  console.log("\n4. Generating narration + submitting avatar video per clip...");
  const clipGenerations = await Promise.all(clips.map(async (clip, i) => {
    const narration = await generateNarration(clip.script, persona.voiceId);
    console.log(`[${clip.label}] Audio ready: ${narration.assetId} (${narration.durationMs}ms)`);
    // Size the video to the actual narration length (+buffer) — a fixed
    // duration cuts the video off mid-sentence if the script runs long.
    const generationId = await submitAvatarVideo({
      startKeyframeId:   sceneAssetIds[i],
      audioAssetId:      narration.assetId,
      performancePrompt: performancePromptFor(persona.name, clip.label),
      durationMs:        narration.durationMs + 800,
    });
    console.log(`[${clip.label}] Video generation submitted: ${generationId}`);
    return generationId;
  }));

  console.log("\n4b. Getting the shared outro clip (generated once, reused per persona)...");
  let outroPublicId = persona.outroCloudinaryPublicId;
  if (outroPublicId) {
    console.log("   Reusing cached outro:", outroPublicId);
  } else {
    console.log("   No cached outro for this persona yet — generating it now...");
    const outro = await generateOutroClip(persona);
    outroPublicId = outro.publicId;
    console.log("   Generated outro:", outroPublicId, "— paste this into creator-personas.ts as outroCloudinaryPublicId");
  }

  console.log(`\n5. Submitting ${clips.length - 1} AI bridge transition clips (between each consecutive pair)...`);
  const bridgeIds = await Promise.all(
    sceneAssetIds.slice(0, -1).map((fromAsset, i) =>
      submitTransitionClip({
        startKeyframeId: fromAsset,
        endKeyframeId:   sceneAssetIds[i + 1],
        prompt: "Same person, natural continuous camera movement turning from one scene into the next, smooth motion blur, seamless walk-through transition.",
      })
    )
  );
  bridgeIds.forEach((id, i) => console.log(`   Bridge ${i + 1} (${clips[i].label}→${clips[i + 1].label}):`, id));

  console.log(`\n6. Polling all ${clips.length + bridgeIds.length} generations in parallel (this takes a few minutes)...`);
  const clipResults = await Promise.all(
    clips.map((clip, i) => pollAndUpload(clip.label, clipGenerations[i], `ugc-test-${runId}-${clip.label}`))
  );
  const bridgeResults = await Promise.all(
    bridgeIds.map((id, i) => pollAndUpload(`bridge_${i + 1}`, id, `ugc-test-${runId}-bridge_${i + 1}`))
  );

  console.log("\n=== INDIVIDUAL RESULTS ===");
  for (const r of [...clipResults, ...bridgeResults]) {
    console.log(r.error ? `${r.label}: FAILED — ${r.error}` : `${r.label}: ${r.secureUrl}`);
  }

  if ([...clipResults, ...bridgeResults].some((r) => r.error)) {
    console.error("\nOne or more generations failed — skipping compilation.");
    return;
  }

  console.log("\n7. Compiling comparison videos (with shared outro appended, bridge audio muted)...");
  const simpleSplice = buildSplicedVideoUrl([
    ...clipResults.map((r) => ({ publicId: r.publicId! })),
    { publicId: outroPublicId! },
  ]);
  const bridgeSplice = buildSplicedVideoUrl([
    { publicId: clipResults[0].publicId! },
    ...bridgeResults.flatMap((bridge, i) => [
      { publicId: bridge.publicId!, muteAudio: true },
      { publicId: clipResults[i + 1].publicId! },
    ]),
    { publicId: outroPublicId! },
  ]);

  console.log("\n=== COMPARISON ===");
  console.log("A) Simple hard-cut splice (no extra cost):");
  console.log("  ", simpleSplice);
  console.log(`B) With AI bridge transitions (${bridgeIds.length} extra generations, bridge audio/music muted):`);
  console.log("  ", bridgeSplice);

  console.log("\n(Captioned individual clips, for reference — captions not yet baked into the compiled versions above)");
  clips.forEach((clip, i) => {
    const result = clipResults[i];
    if (result.publicId && clip.captions?.length) {
      const kind = clip.label.endsWith("_dos") ? "do" : "dont";
      console.log(`${clip.label} captioned:`, buildCaptionedVideoUrl(result.publicId, clip.captions, kind));
    }
  });
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
