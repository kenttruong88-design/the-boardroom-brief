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
 * regenerate everything anyway.
 *
 * These become a richer identity-reference pool for future scene generation
 * — instead of deriving every scene from one single reference photo.
 *
 * After running, paste the printed asset ids into that persona's
 * `characterSheet` field in app/lib/social/creator-personas.ts.
 *
 * Usage (from project root):
 *   npx tsx scripts/generate-character-sheet.mts <persona-key> [--force]
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
if (!personaKey) {
  console.error("Usage: npx tsx scripts/generate-character-sheet.mts <persona-key> [--force]");
  process.exit(1);
}

const { getCreatorPersona }       = await import("../app/lib/social/creator-personas");
const { uploadImageAsset, generateSceneImage } = await import("../app/lib/social/hedra-client");
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
const toGenerate = Object.entries(SHOTS).filter(([shotName]) => force || !existing[shotName as keyof typeof existing]);

if (toGenerate.length === 0) {
  console.log("All shots already generated. Pass --force to regenerate.");
  process.exit(0);
}

console.log(`Generating ${toGenerate.length}/${Object.keys(SHOTS).length} shot(s): ${toGenerate.map(([n]) => n).join(", ")}`);
for (const shotName of Object.keys(SHOTS)) {
  if (!toGenerate.find(([n]) => n === shotName)) console.log(`  (skipping ${shotName} — already generated)`);
}

console.log("\nUploading identity reference...");
const identityAssetId = await uploadImageAsset(persona.referenceImageUrl, `${persona.key}-reference.png`);

const results: Record<string, string> = { ...existing };
for (const [shotName, prompt] of toGenerate) {
  console.log(`\n[${shotName}] generating...`);
  const assetId = await generateSceneImage(identityAssetId, prompt, `${persona.key}-sheet-${shotName}.png`);
  results[shotName] = assetId;
  console.log(`[${shotName}] asset id: ${assetId}`);
}

console.log("\nDone. Paste this into creator-personas.ts under the persona's `characterSheet` field:");
console.log(JSON.stringify(results, null, 2));
