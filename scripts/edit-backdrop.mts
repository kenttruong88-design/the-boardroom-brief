#!/usr/bin/env -S npx tsx
/**
 * edit-backdrop.mts
 * ──────────────────
 * Targeted edit of a persona's fixed intro/outro start frame with
 * google/nano-banana-pro (the same single-reference edit that fixed Suki's
 * pocketed hand, scripts/suki-fix-hands.mts). Character-3 anchors heavily on
 * the start frame's pose, so stance/hand problems are fixed here, not in the
 * performance prompt.
 *
 * Each variant costs one nano-banana-pro image (~15 Hedra credits). Outputs
 * are saved next to the source as <out>-a.png, <out>-b.png, ... and each
 * Hedra asset id is printed (ready for introSceneImageAssetId /
 * outroSceneImageAssetId).
 *
 * Usage (from project root):
 *   npx tsx scripts/edit-backdrop.mts <source.png[,ref2,...]> <out-basename> <prompt.txt> [count]
 *
 * Multiple references (local paths or Hedra asset ids) turn it into a
 * composite: put a person-free scene first, then identity shots, and
 * describe the pose in the prompt.
 *
 * Requires HEDRA_API_KEY in .env.local.
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
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

const [sourcePath, outBase, promptPath, countArg] = process.argv.slice(2);
if (!sourcePath || !outBase || !promptPath) {
  console.error("Usage: npx tsx scripts/edit-backdrop.mts <source.png> <out-basename> <prompt.txt> [count]");
  process.exit(1);
}
const count  = Math.max(1, parseInt(countArg ?? "1", 10));
// --model <slug> swaps nano-banana-pro for another Hedra image model
// (e.g. fal/krea-2-large, fal/flux2-max-i2i); mind its reference limit.
const modelIdx = process.argv.indexOf("--model");
const model    = modelIdx !== -1 ? process.argv[modelIdx + 1] : undefined;
const prompt = readFileSync(resolve(ROOT, promptPath), "utf8").trim();

const { uploadLocalImageAsset, generateSceneImage } = await import("../app/lib/social/hedra-client");

// <source> may be a comma-separated list mixing local image paths and existing
// Hedra asset ids (e.g. a persona's characterSheet shots), in reference order.
// The first entry also decides the output folder (an asset id → reference/).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sources = sourcePath.split(",").map((s) => s.trim()).filter(Boolean);
const sourceIds: string[] = [];
for (const s of sources) {
  sourceIds.push(UUID.test(s) ? s : await uploadLocalImageAsset(readFileSync(resolve(ROOT, s)), basename(s)));
}
console.log("References:", sourceIds.join(", "));
const sourceId = sourceIds.length === 1 ? sourceIds[0] : sourceIds;

const outDir  = UUID.test(sources[0]) ? resolve(ROOT, "reference") : dirname(resolve(ROOT, sources[0]));
const letters = "abcdefghij";
await Promise.all(Array.from({ length: count }, async (_, i) => {
  const name    = `${outBase}-${letters[i]}`;
  const assetId = await generateSceneImage(sourceId, prompt, `${name}.png`, { model });
  const res     = await fetch(`https://api.hedra.com/web-app/public/assets?type=image&ids=${assetId}`, {
    headers: { "X-API-Key": process.env.HEDRA_API_KEY! },
  });
  const [asset] = await res.json() as Array<{ asset?: { url?: string } }>;
  if (!asset?.asset?.url) throw new Error(`No url for ${assetId}`);
  writeFileSync(resolve(outDir, `${name}.png`), Buffer.from(await (await fetch(asset.asset.url)).arrayBuffer()));
  console.log(`${name}.png  asset ${assetId}`);
}));
