#!/usr/bin/env -S npx tsx
/**
 * zoom-frame.mts
 * ──────────────
 * Crops a full-body start frame in toward her face (app/lib/social/frame-zoom.ts)
 * so Hedra animates a larger face. No Hedra credits (one Claude call to find
 * the face).
 *
 * Usage (from project root):
 *   npx tsx scripts/zoom-frame.mts <png> [png2 ...] [--below <faces>] [--face-x <0..1>]
 *
 * --below   crop bottom in face heights below her face: ~5 mid-thigh, ~6 knees (default)
 * --face-x  where her face sits across the crop (default 0.5 = centred)
 *
 * Writes <png>-zoom.png (1080x1920) next to each frame.
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

const args   = process.argv.slice(2);
const flag   = (name: string) => { const i = args.indexOf(name); return i !== -1 ? Number(args[i + 1]) : undefined; };
const below  = flag("--below");
const faceX  = flag("--face-x");
const frames = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (frames.length === 0) {
  console.error("Usage: npx tsx scripts/zoom-frame.mts <png> [png2 ...] [--below <faces>] [--face-x <0..1>]");
  process.exit(1);
}

const { zoomStartFrame } = await import("../app/lib/social/frame-zoom");

for (const frame of frames) {
  const out = resolve(ROOT, frame.replace(/\.png$/i, "") + "-zoom.png");
  writeFileSync(out, await zoomStartFrame(readFileSync(resolve(ROOT, frame)), { facesBelow: below, faceX }));
  console.log(`${frame} -> ${out}`);
}
