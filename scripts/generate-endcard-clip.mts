#!/usr/bin/env -S npx tsx
/**
 * generate-endcard-clip.mts
 * ────────────────────────────
 * Generates a short static "end card" video — brand-navy background, white
 * serif website URL, thin rust-red accent rule — appended after the outro
 * clip in the final compiled video so every video closes on a dark screen
 * with the site link rather than cutting straight from Suki's face.
 *
 * No Hedra/avatar cost: the card is pure typography, built locally with
 * sharp (crisp vector text — same reasoning as the AT-sign logo compositing
 * elsewhere in this pipeline: don't gamble text rendering on an AI image
 * model), then converted image→video and re-hosted as a real Cloudinary
 * video resource so it can slot into buildSplicedVideoUrl() exactly like
 * every other clip. A short fade-in is baked in for a smoother cut out of
 * the outro's talking shot into the dark card.
 *
 * Usage: npx tsx scripts/generate-endcard-clip.mts
 * Requires CLOUDINARY_* in .env.local.
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

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

const { v2: cloudinary } = await import("cloudinary");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const WIDTH  = 720;
const HEIGHT = 1280;
const NAVY   = "#0f1923";
const RUST   = "#c8391a";
const URL_TEXT = "www.thealignmenttimes.com";

const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${NAVY}"/>
  <text x="50%" y="48%" text-anchor="middle" dominant-baseline="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="40" fill="#ffffff">
    ${URL_TEXT}
  </text>
  <rect x="${WIDTH / 2 - 60}" y="${HEIGHT * 0.48 + 36}" width="120" height="3" fill="${RUST}"/>
</svg>`;

async function main() {
  console.log("Rendering end-card image locally (sharp)...");
  const pngBuf = await sharp(Buffer.from(svg)).png().toBuffer();
  const localPath = resolve(ROOT, "reference", "suki-endcard.png");
  writeFileSync(localPath, pngBuf);
  console.log("Saved:", localPath);

  console.log("\nUploading end-card image to Cloudinary...");
  const imageUpload = await cloudinary.uploader.upload(
    `data:image/png;base64,${pngBuf.toString("base64")}`,
    { folder: "boardroom-brief/ugc", public_id: "suki-endcard-bg", overwrite: true }
  );
  console.log("Image public_id:", imageUpload.public_id);

  console.log("\nConverting image to a silent video clip (image->video, 3s, fade in)...");
  const videoDeliveryUrl = cloudinary.url(imageUpload.public_id, {
    resource_type: "image",
    format:        "mp4",
    transformation: [
      { width: WIDTH, height: HEIGHT, crop: "fill" },
      { duration: 3.0 },
      { effect: "fade:800" },
    ],
  });
  console.log("Image->video delivery URL:", videoDeliveryUrl);

  console.log("\nRe-hosting as a real Cloudinary video resource (so it splices like any other clip)...");
  const videoUpload = await cloudinary.uploader.upload(videoDeliveryUrl, {
    resource_type: "video",
    folder:        "boardroom-brief/ugc",
    public_id:     "suki-endcard",
    overwrite:     true,
  });

  console.log("\nDone.");
  console.log("public_id:", videoUpload.public_id);
  console.log("URL:", videoUpload.secure_url);
  console.log("\nPaste this into creator-personas.ts under \"suki\":");
  console.log(`  endcardCloudinaryPublicId: "${videoUpload.public_id}",`);
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
