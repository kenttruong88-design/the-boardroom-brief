#!/usr/bin/env -S npx tsx
/**
 * review-frames.mts
 * ─────────────────
 * Runs the Claude identity check (app/lib/social/frame-identity-review.ts)
 * on local scene frames, without generating anything. No Hedra credits.
 *
 * Usage (from project root):
 *   npx tsx scripts/review-frames.mts <persona> <png> [png2 ...]
 *
 * Writes <png>.review.json next to each frame.
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
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

const [personaKey, ...frames] = process.argv.slice(2);
if (!personaKey || frames.length === 0) {
  console.error("Usage: npx tsx scripts/review-frames.mts <persona> <png> [png2 ...]");
  process.exit(1);
}

const { getCreatorPersona } = await import("../app/lib/social/creator-personas");
const { reviewSceneFrame, formatFrameReview, referenceAssetIds } = await import("../app/lib/social/frame-identity-review");
const { getImageAssetUrl } = await import("../app/lib/social/hedra-client");

const persona = getCreatorPersona(personaKey);
// Download the references once for every frame.
const refs = await Promise.all(referenceAssetIds(persona).map(async (id) => Buffer.from(await (await fetch(await getImageAssetUrl(id))).arrayBuffer())));

for (const frame of frames) {
  const review = await reviewSceneFrame(persona, readFileSync(resolve(ROOT, frame)), { refs });
  console.log(`\n${frame}\n  ${formatFrameReview(review)}`);
  writeFileSync(resolve(ROOT, `${frame}.review.json`), JSON.stringify(review, null, 2) + "\n");
}
