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
 *   npx tsx scripts/edit-backdrop.mts <source.png> <out-basename> <prompt.txt> [count]
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
const prompt = readFileSync(resolve(ROOT, promptPath), "utf8").trim();

const { uploadLocalImageAsset, generateSceneImage } = await import("../app/lib/social/hedra-client");

const sourceId = await uploadLocalImageAsset(readFileSync(resolve(ROOT, sourcePath)), basename(sourcePath));
console.log("Source uploaded:", sourceId);

const outDir  = dirname(resolve(ROOT, sourcePath));
const letters = "abcdefghij";
await Promise.all(Array.from({ length: count }, async (_, i) => {
  const name    = `${outBase}-${letters[i]}`;
  const assetId = await generateSceneImage(sourceId, prompt, `${name}.png`);
  const res     = await fetch(`https://api.hedra.com/web-app/public/assets?type=image&ids=${assetId}`, {
    headers: { "X-API-Key": process.env.HEDRA_API_KEY! },
  });
  const [asset] = await res.json() as Array<{ asset?: { url?: string } }>;
  if (!asset?.asset?.url) throw new Error(`No url for ${assetId}`);
  writeFileSync(resolve(outDir, `${name}.png`), Buffer.from(await (await fetch(asset.asset.url)).arrayBuffer()));
  console.log(`${name}.png  asset ${assetId}`);
}));
