#!/usr/bin/env node
/**
 * test-hedra-avatar.mjs
 * ──────────────────────
 * One-off test script: generate a Suki talking-avatar video via the Hedra
 * public API (Character-3 model), using the same reference image + hook
 * line we tested on Higgsfield, for a side-by-side quality comparison.
 *
 * Run locally (NOT from the Cowork sandbox — api.hedra.com is blocked
 * there by the network allowlist). Your local machine has normal internet
 * access, so this will work fine from your own terminal.
 *
 * Usage (from project root):
 *   node scripts/test-hedra-avatar.mjs
 *
 * Requires HEDRA_API_KEY in .env.local (already added).
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const DOTENV    = resolve(ROOT, ".env.local");

// ── Load .env.local ──────────────────────────────────────────────────────────

function loadEnv(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv(DOTENV);

const API_KEY = process.env.HEDRA_API_KEY;
if (!API_KEY) {
  console.error("Missing HEDRA_API_KEY in .env.local — add it and re-run.");
  process.exit(1);
}

const BASE = "https://api.hedra.com/web-app/public";
const headers = { "X-API-Key": API_KEY, "Content-Type": "application/json" };

// ── Test inputs ───────────────────────────────────────────────────────────────
// Same reference image + hook line used in the Higgsfield test, for a fair
// side-by-side comparison.
const SUKI_IMAGE_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_3G4nfIhvBEAbwgXYF7BIO9A8UQ0/hf_20260723_205945_9811b4ce-863c-43c6-ae21-51e5d8f84fb0.png";

const HOOK_LINE =
  "Japan treats dinner like a sacred ritual. Mexico treats it like one too — they're just worshipping completely different gods.";

const PERFORMANCE_PROMPT =
  "Suki speaking directly to camera, warm and confident, documentary travel vlog style, natural hand gestures, engaging eye contact.";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("1. Fetching available video models...");
  const models = await get("/models?types=video");
  const character3 = models.find(
    (m) =>
      (m.name && m.name.toLowerCase().includes("character")) ||
      (m.slug && m.slug.toLowerCase().includes("character"))
  );
  if (!character3) {
    console.error("Could not find a Character-3 model automatically. Full model list:");
    console.error(JSON.stringify(models.map((m) => ({ id: m.id, slug: m.slug, name: m.name })), null, 2));
    process.exit(1);
  }
  console.log(`   Found model: ${character3.name} (id: ${character3.id}, slug: ${character3.slug})`);

  console.log("2. Fetching available voices...");
  const voices = await get("/voices");
  if (!voices.length) {
    console.error("No voices returned from /voices.");
    process.exit(1);
  }
  // Prefer a female-labeled voice for Suki; fall back to the first available.
  const voice =
    voices.find((v) => v.asset?.labels?.some((l) => l.value?.toLowerCase() === "female")) ||
    voices[0];
  console.log(`   Using voice: ${voice.name} (id: ${voice.id})`);

  // NOTE: passing `audio_generation` (nested TTS-in-video) to /generations
  // reliably 400s with "model missing not valid for generation type
  // text_to_speech" on this account, regardless of voice/model_slug used —
  // looks like a backend bug in that code path. Generating the audio as its
  // own standalone request first, then referencing it via `audio_id`, works.
  console.log("3. Generating narration audio (text-to-speech)...");
  const audioGen = await post("/generations", {
    type: "text_to_speech",
    voice_id: voice.id,
    text: HOOK_LINE,
  });
  const audioGenerationId = audioGen.id;
  if (!audioGenerationId) {
    console.error("No audio generation id returned — full response:", JSON.stringify(audioGen, null, 2));
    process.exit(1);
  }

  console.log("4. Polling audio generation (checks every 3s)...");
  let audioAssetId = null;
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const status = await get(`/generations/${audioGenerationId}/status`);
    console.log(`   [${i + 1}] status: ${status.status}  progress: ${Math.round((status.progress ?? 0) * 100)}%`);
    if (status.status === "complete") {
      audioAssetId = status.asset_id;
      break;
    }
    if (status.status === "error") {
      console.error(`\nAudio generation failed: ${status.error_message}`);
      process.exit(1);
    }
  }
  if (!audioAssetId) {
    console.error("\nAudio generation timed out after 2 minutes of polling.");
    process.exit(1);
  }
  console.log(`   Audio ready: asset ${audioAssetId}`);

  console.log("5. Submitting avatar video generation...");
  const generation = await post("/generations", {
    type: "video",
    ai_model_id: character3.id,
    start_keyframe_url: SUKI_IMAGE_URL,
    audio_id: audioAssetId,
    generated_video_inputs: {
      text_prompt: PERFORMANCE_PROMPT,
      aspect_ratio: "9:16",
      duration_ms: 10000,
    },
  });
  console.log(`   Generation submitted: ${generation.id ?? JSON.stringify(generation)}`);

  const generationId = generation.id;
  if (!generationId) {
    console.error("No generation id returned — full response:", JSON.stringify(generation, null, 2));
    process.exit(1);
  }

  console.log("6. Polling for completion (checks every 5s)...");
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const status = await get(`/generations/${generationId}/status`);
    console.log(`   [${i + 1}] status: ${status.status}  progress: ${Math.round((status.progress ?? 0) * 100)}%`);
    if (status.status === "complete") {
      console.log("\nDone! Video URL:");
      console.log(`   ${status.url ?? status.download_url}`);
      if (status.download_url) console.log(`   Download: ${status.download_url}`);
      return;
    }
    if (status.status === "error") {
      console.error(`\nGeneration failed: ${status.error_message}`);
      process.exit(1);
    }
  }
  console.error("\nTimed out after 5 minutes of polling. Check the Hedra dashboard for status.");
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
