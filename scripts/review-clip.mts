#!/usr/bin/env -S npx tsx
/**
 * review-clip.mts
 * ───────────────
 * Runs Claude's clip review (app/lib/social/clip-review.ts) on rendered
 * Cloudinary clips: samples stills across each clip and checks that she
 * stays the same woman, keeps her eyes open, keeps the gestures the persona
 * asks for, and that the camera and scene hold still. No Hedra credits.
 *
 * Usage (from project root):
 *   npx tsx scripts/review-clip.mts <persona> <cloudinary-video-url> [url2 ...]
 *
 * Writes reference/ugc-test/clip-reviews/<clip>.json plus the two contact
 * sheets Claude saw (<clip>-faces.jpg, <clip>-frames.jpg), which are also
 * uploaded to Cloudinary so the verdict can be shared as links.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from "fs";
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

const [personaKey, ...urls] = process.argv.slice(2);
if (!personaKey || urls.length === 0) {
  console.error("Usage: npx tsx scripts/review-clip.mts <persona> <cloudinary-video-url> [url2 ...]");
  process.exit(1);
}

const { getCreatorPersona } = await import("../app/lib/social/creator-personas");
const { referenceAssetIds, fetchAsset } = await import("../app/lib/social/frame-identity-review");
const { reviewClip, formatClipReview } = await import("../app/lib/social/clip-review");
const { v2: cloudinary } = await import("cloudinary");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const persona = getCreatorPersona(personaKey);
const refs    = await Promise.all(referenceAssetIds(persona).map(fetchAsset));
const outDir  = resolve(ROOT, "reference", "ugc-test", "clip-reviews");
mkdirSync(outDir, { recursive: true });

let failed = 0;
for (const url of urls) {
  const publicId = url.replace(/^.*\/video\/upload\/(v\d+\/)?/, "").replace(/\.\w+(\?.*)?$/, "");
  const { duration } = await cloudinary.api.resource(publicId, { resource_type: "video", media_metadata: true });
  const name   = publicId.split("/").pop()!;
  const review = await reviewClip(persona, url, duration, { refs, debugDir: outDir });
  renameSync(resolve(outDir, "clip-faces.jpg"),  resolve(outDir, `${name}-faces.jpg`));
  renameSync(resolve(outDir, "clip-frames.jpg"), resolve(outDir, `${name}-frames.jpg`));
  if (existsSync(resolve(outDir, "clip-eyes.jpg"))) renameSync(resolve(outDir, "clip-eyes.jpg"), resolve(outDir, `${name}-eyes.jpg`));
  // The contact sheets go up too, so the verdict can be shared as links
  // instead of local paths.
  const sheets: Record<string, string> = {};
  for (const kind of ["faces", "frames", "eyes"]) {
    if (!existsSync(resolve(outDir, `${name}-${kind}.jpg`))) continue;
    const up = await cloudinary.uploader.upload(resolve(outDir, `${name}-${kind}.jpg`), {
      folder: "boardroom-brief/ugc-test/clip-reviews", public_id: `${name}-${kind}`, overwrite: true,
    });
    sheets[kind] = up.secure_url;
  }
  writeFileSync(resolve(outDir, `${name}.json`), JSON.stringify({ url, duration, sheets, ...review }, null, 2) + "\n");
  console.log(`\n${name} (${duration.toFixed(1)}s)\n  ${formatClipReview(review)}\n  faces:  ${sheets.faces}\n  frames: ${sheets.frames}`);
  if (!review.pass) failed++;
}
console.log(`\n${urls.length - failed}/${urls.length} clips passed.`);
