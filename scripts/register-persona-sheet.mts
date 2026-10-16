#!/usr/bin/env -S npx tsx
/**
 * register-persona-sheet.mts
 * ──────────────────────────────
 * Registers an externally-made character sheet (e.g. built in Higgsfield
 * rather than via generate-character-sheet.mts) with the video pipeline:
 * uploads each `reference/<key>/<key>-sheet-<shotName>.png` to Hedra as an
 * image asset, and uploads the frontNeutral shot to Cloudinary as the
 * persona's `referenceImageUrl`. Uploads only — spends no Hedra credits.
 *
 * Prints the values to paste into that persona's entry in
 * app/lib/social/creator-personas.ts.
 *
 * Usage (from project root):
 *   npx tsx scripts/register-persona-sheet.mts priya
 *
 * Requires HEDRA_API_KEY and CLOUDINARY_* in .env.local.
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

const key = process.argv[2];
if (!key) {
  console.error("Usage: npx tsx scripts/register-persona-sheet.mts <persona-key>");
  process.exit(1);
}

const { uploadLocalImageAsset } = await import("../app/lib/social/hedra-client");
const { v2: cloudinary }        = await import("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const SHOTS = [
  "frontNeutral", "threeQuarterNeutral", "profileNeutral",
  "frontSmiling", "frontSerious", "fullBodyFront", "fullBodySide",
] as const;

const dir = resolve(ROOT, "reference", key);
const sheet: Record<string, string> = {};
for (const shot of SHOTS) {
  const file = resolve(dir, `${key}-sheet-${shot}.png`);
  if (!existsSync(file)) {
    console.log(`  (skipping ${shot} — ${file} not found)`);
    continue;
  }
  sheet[shot] = await uploadLocalImageAsset(readFileSync(file), `${key}-sheet-${shot}.png`);
  console.log(`  ${shot} -> ${sheet[shot]}`);
}

const ref = await cloudinary.uploader.upload(resolve(dir, `${key}-sheet-frontNeutral.png`), {
  public_id:     `boardroom-brief/ugc/${key}-reference`,
  overwrite:     true,
  resource_type: "image",
});

console.log(`\nreferenceImageUrl: "${ref.secure_url}",`);
console.log("characterSheet: {");
for (const [shot, id] of Object.entries(sheet)) console.log(`  ${shot.padEnd(20)} "${id}",`);
console.log("},");
