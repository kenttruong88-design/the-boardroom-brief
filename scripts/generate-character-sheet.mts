#!/usr/bin/env -S npx tsx
/**
 * generate-character-sheet.mts
 * ──────────────────────────────
 * Generates a persona's reference character sheet: 3 head/shoulders angles
 * (front, three-quarter, profile) at a neutral expression, 2 more
 * expressions (smiling, serious) at the front angle, plus full-body front
 * and side standing shots — 7 images total. All in a deliberately plain/
 * basic outfit (no jacket, no pattern) so it's easy to swap later.
 *
 * Populated INCREMENTALLY: any shot already present in the persona's
 * `characterSheet` (creator-personas.ts) is skipped, so re-running after
 * adding new shot types only generates what's missing. Pass --force to
 * regenerate everything anyway, or --only <shotName> to regenerate just one
 * shot that drifted (e.g. an outlier caught on visual review) without
 * touching the rest. --only also feeds the OTHER already-good shots in as
 * extra reference alongside the 7 real photos, so the regenerated shot is
 * pulled toward matching the sheet's existing consistency, not just
 * re-rolled fresh from the raw photos again.
 *
 * These become a richer identity-reference pool for future scene generation
 * — instead of deriving every scene from one single reference photo.
 *
 * After running, paste the printed asset ids into that persona's
 * `characterSheet` field in app/lib/social/creator-personas.ts.
 *
 * Usage (from project root):
 *   npx tsx scripts/generate-character-sheet.mts <persona-key> [--force]
 *   npx tsx scripts/generate-character-sheet.mts <persona-key> --only <shotName>
 *   npx tsx scripts/generate-character-sheet.mts suki
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

const personaKey = process.argv[2];
const force = process.argv.includes("--force");
const onlyIdx = process.argv.indexOf("--only");
const onlyShot = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : undefined;
if (!personaKey) {
  console.error("Usage: npx tsx scripts/generate-character-sheet.mts <persona-key> [--force | --only <shotName>]");
  process.exit(1);
}
if (onlyIdx !== -1 && !onlyShot) {
  console.error("--only requires a shot name, e.g. --only frontNeutral");
  process.exit(1);
}

const { getCreatorPersona }       = await import("../app/lib/social/creator-personas");
const { uploadLocalImageAsset, generateSceneImage } = await import("../app/lib/social/hedra-client");
const { v2: cloudinary }          = await import("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const persona = getCreatorPersona(personaKey);

const OUTFIT = "wearing a simple plain white t-shirt and plain black trousers, no jacket, no patterns, no accessories";
const BACKDROP = "plain neutral light-grey background, even studio lighting, no props";

const SHOTS: Record<string, string> = {
  frontNeutral:        `Same woman, same face and identity, ${OUTFIT}, front-facing straight-on portrait, head and shoulders, neutral relaxed expression, ${BACKDROP}.`,
  threeQuarterNeutral: `Same woman, same face and identity, ${OUTFIT}, three-quarter angle portrait (head turned about 45 degrees), head and shoulders, neutral relaxed expression, ${BACKDROP}.`,
  profileNeutral:      `Same woman, same face and identity, ${OUTFIT}, full side profile portrait, head and shoulders, neutral relaxed expression, ${BACKDROP}.`,
  frontSmiling:        `Same woman, same face and identity, ${OUTFIT}, front-facing straight-on portrait, head and shoulders, warm genuine smile, ${BACKDROP}.`,
  frontSerious:        `Same woman, same face and identity, ${OUTFIT}, front-facing straight-on portrait, head and shoulders, serious thoughtful expression, ${BACKDROP}.`,
  fullBodyFront:       `Same woman, same face and identity, ${OUTFIT}, FULL-LENGTH head-to-toe fashion catalog photograph, entire body visible from the top of her head down to her shoes and the floor beneath her feet, standing several steps back from the camera so there is visible empty space above her head and below her feet in the frame, front-facing standing pose, arms relaxed at sides, neutral relaxed expression, ${BACKDROP}. Do not crop at the waist, hips, or knees — the shoes and floor must be visible.`,
  fullBodySide:        `Same woman, same face and identity, ${OUTFIT}, FULL-LENGTH head-to-toe fashion catalog photograph, entire body visible from the top of her head down to her shoes and the floor beneath her feet, standing several steps back from the camera so there is visible empty space above her head and below her feet in the frame. Her ENTIRE BODY — shoulders, hips, and feet, not just her head — is rotated 90 degrees to face sideways, so the camera sees a true side silhouette: one shoulder pointing toward the camera and one away, both feet pointing the same sideways direction. This is NOT a front-facing body with the head turned — the torso and hips must also be in profile. Arms relaxed at sides, neutral relaxed expression, ${BACKDROP}. Do not crop at the waist, hips, or knees — the shoes and floor must be visible.`,
};

console.log(`Generating character sheet for ${persona.name}...`);

const existing = persona.characterSheet ?? {};

if (onlyShot && !SHOTS[onlyShot]) {
  console.error(`Unknown shot "${onlyShot}". Valid: ${Object.keys(SHOTS).join(", ")}`);
  process.exit(1);
}

const toGenerate = onlyShot
  ? [[onlyShot, SHOTS[onlyShot]] as [string, string]]
  : Object.entries(SHOTS).filter(([shotName]) => force || !existing[shotName as keyof typeof existing]);

if (toGenerate.length === 0) {
  console.log("All shots already generated. Pass --force to regenerate.");
  process.exit(0);
}

console.log(`Generating ${toGenerate.length}/${Object.keys(SHOTS).length} shot(s): ${toGenerate.map(([n]) => n).join(", ")}`);
for (const shotName of Object.keys(SHOTS)) {
  if (!toGenerate.find(([n]) => n === shotName)) console.log(`  (skipping ${shotName} — already generated)`);
}

console.log("\nUploading identity references (reference/Suki 1.png .. Suki 7.png)...");
const identityAssetIds: string[] = [];
for (let i = 1; i <= 7; i++) {
  const filePath = resolve(ROOT, "reference", `Suki ${i}.png`);
  if (!existsSync(filePath)) {
    console.log(`  (skipping Suki ${i}.png — not found)`);
    continue;
  }
  const buf = readFileSync(filePath);
  const assetId = await uploadLocalImageAsset(buf, `${persona.key}-ref-${i}.png`);
  identityAssetIds.push(assetId);
  console.log(`  Suki ${i}.png -> ${assetId}`);
}
if (identityAssetIds.length === 0) {
  throw new Error("No reference photos found in reference/Suki 1.png .. Suki 7.png");
}

if (onlyShot) {
  console.log(`\n--only ${onlyShot}: also feeding the sheet's other already-good shots as reference, to pull the regeneration toward matching them (not just re-rolling fresh from the raw photos).`);
  for (const [shotName, assetId] of Object.entries(existing)) {
    if (shotName !== onlyShot && assetId) {
      identityAssetIds.push(assetId);
      console.log(`  + ${shotName} -> ${assetId}`);
    }
  }
}

console.log(`Using ${identityAssetIds.length} reference image(s) total.`);

const results: Record<string, string> = { ...existing };
for (const [shotName, prompt] of toGenerate) {
  console.log(`\n[${shotName}] generating...`);
  const assetId = await generateSceneImage(identityAssetIds, prompt, `${persona.key}-sheet-${shotName}.png`);
  results[shotName] = assetId;
  console.log(`[${shotName}] asset id: ${assetId}`);
}

console.log("\nDone. Paste this into creator-personas.ts under the persona's `characterSheet` field:");
console.log(JSON.stringify(results, null, 2));
