#!/usr/bin/env -S npx tsx
/**
 * generate-outro-clip.mts
 * ────────────────────────
 * Generates a persona's shared closing clip ONCE and uploads it to Cloudinary
 * under a stable public_id (boardroom-brief/ugc/<persona>-outro). This clip
 * is reused as the last piece of every video for that persona — it is NOT
 * regenerated per article.
 *
 * After running, paste the printed public_id into that persona's
 * `outroCloudinaryPublicId` field in app/lib/social/creator-personas.ts.
 *
 * Usage (from project root):
 *   npx tsx scripts/generate-outro-clip.mts <persona-key>
 *   npx tsx scripts/generate-outro-clip.mts suki
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
if (!personaKey) {
  console.error("Usage: npx tsx scripts/generate-outro-clip.mts <persona-key>");
  process.exit(1);
}

const { getCreatorPersona } = await import("../app/lib/social/creator-personas");
const { generateOutroClip } = await import("../app/lib/social/outro-clip");

const persona = getCreatorPersona(personaKey);
console.log(`Generating outro clip for ${persona.name}...`);
console.log(`Script: "${persona.outroScript}"`);
console.log(`Scene: "${persona.outroScene}"`);

const result = await generateOutroClip(persona);

console.log("\nDone.");
console.log("public_id:", result.publicId);
console.log("URL:", result.secureUrl);
console.log(`\nPaste this into creator-personas.ts under "${personaKey}":`);
console.log(`  outroCloudinaryPublicId: "${result.publicId}",`);
