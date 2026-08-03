#!/usr/bin/env -S npx tsx
/**
 * test-ugc-script.mts
 * ────────────────────
 * Dry-runs the Claude script-writing step of the Suki UGC video pipeline
 * (app/lib/social/ugc-*) against a real content/out-of-office/*.md source —
 * no Hedra calls, no credits spent. Produces 5 clip scripts (hook, each
 * country's Do's, each country's Don'ts) — use this to check them before
 * wiring up /api/editorial/ugc/generate for real.
 *
 * Usage (from project root):
 *   npx tsx scripts/test-ugc-script.mts content/out-of-office/<file>.md
 *
 * Requires ANTHROPIC_API_KEY in .env.local (already added).
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
  console.error("Usage: npx tsx scripts/test-ugc-script.mts <path-to-out-of-office-md>");
  process.exit(1);
}

// Dynamic imports so env vars are loaded before claude.ts constructs its
// Anthropic client at module scope.
const { parseOutOfOfficeArticle } = await import("../app/lib/social/out-of-office-parser");
const { writeUgcScript }          = await import("../app/lib/social/ugc-script-writer");
const { getCreatorPersona }       = await import("../app/lib/social/creator-personas");

const markdown = readFileSync(resolve(ROOT, file), "utf8");
const parsed = parseOutOfOfficeArticle(markdown);
console.log("Headline:", parsed.headline);
console.log("Countries:", parsed.countries);

const persona = getCreatorPersona("suki");
const result = await writeUgcScript({ parsed, persona });

function report(label: string, text: string) {
  const words = text.split(/\s+/).length;
  console.log(`\n--- ${label} (~${words}w, ~${(words / 2.75).toFixed(1)}s) ---`);
  console.log(text);
}
report("CLIP 1: HOOK", result.hookClip);
report("CLIP 2: COUNTRY A DO'S", result.countryADosClip);
result.countryADosCaptions.forEach((item, i) => console.log(`    Caption ${i + 1}: DO: ${item}`));
report("CLIP 3: COUNTRY A DON'TS", result.countryADontsClip);
result.countryADontsCaptions.forEach((item, i) => console.log(`    Caption ${i + 1}: DON'T: ${item}`));
report("CLIP 4: COUNTRY B DO'S", result.countryBDosClip);
result.countryBDosCaptions.forEach((item, i) => console.log(`    Caption ${i + 1}: DO: ${item}`));
report("CLIP 5: COUNTRY B DON'TS", result.countryBDontsClip);
result.countryBDontsCaptions.forEach((item, i) => console.log(`    Caption ${i + 1}: DON'T: ${item}`));
