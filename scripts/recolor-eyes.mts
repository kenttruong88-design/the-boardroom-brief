#!/usr/bin/env -S npx tsx
/**
 * recolor-eyes.mts
 * ────────────────
 * Changes only a persona's eye colour on existing images (character sheet
 * shots, a multi-panel sheet, scene frames) without redrawing her face.
 * Whole-image edits always drift the face (lesson from the 10-25 hand fix),
 * so each image is edited with nano-banana-2.1, aligned back onto the
 * original, and only a feathered band around the eyes is pasted in.
 *
 * Usage (from project root):
 *   npx tsx scripts/recolor-eyes.mts <src.png> <out.png> <prompt.txt> [--grid 4,2] [--resolution 1K|2K]
 *
 * --grid cols,rows   treat the image as a sheet of 9:16 panels, one edit each
 * Each edit is one nano-banana-2.1 image (~7 credits at 1K, ~10.5 at 2K).
 *
 * Requires HEDRA_API_KEY and ANTHROPIC_API_KEY (face location) in .env.local.
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

const args = process.argv.slice(2);
const opt  = (name: string) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : undefined; };
const [src, out, promptPath] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!src || !out || !promptPath) {
  console.error("Usage: npx tsx scripts/recolor-eyes.mts <src.png> <out.png> <prompt.txt> [--grid 4,2] [--resolution 1K|2K]");
  process.exit(1);
}
const [cols, rows] = (opt("--grid") ?? "1,1").split(",").map(Number);
const resolution   = opt("--resolution") ?? "1K";
const prompt       = readFileSync(resolve(ROOT, promptPath), "utf8").trim();

const sharp = (await import("sharp")).default;
const { uploadLocalImageAsset, generateSceneImage, getImageAssetUrl } = await import("../app/lib/social/hedra-client");
const { locateFace, fetchWithRetry } = await import("../app/lib/social/frame-identity-review");

/** Best scale + offset placing `edit` over `orig` (grayscale, downsampled search). */
async function align(orig: Buffer, edit: Buffer, w: number, h: number) {
  const D  = Math.max(1, Math.round(w / 200));
  const w4 = Math.round(w / D), h4 = Math.round(h / D);
  const o  = await sharp(orig).resize(w4, h4, { fit: "fill" }).grayscale().raw().toBuffer();
  let best = { err: Infinity, s: 1, dx: 0, dy: 0 };
  for (let s = 0.97; s <= 1.0301; s += 0.005) {
    const sw = Math.round(w4 * s), sh = Math.round(h4 * s);
    const e  = await sharp(edit).resize(sw, sh, { fit: "fill" }).grayscale().raw().toBuffer();
    for (let dx = -8; dx <= 8; dx++) for (let dy = -8; dy <= 8; dy++) {
      let err = 0, n = 0;
      for (let y = 4; y < h4 - 4; y += 2) for (let x = 4; x < w4 - 4; x += 2) {
        const ex = x + dx, ey = y + dy;
        if (ex < 0 || ey < 0 || ex >= sw || ey >= sh) continue;
        err += Math.abs(o[y * w4 + x] - e[ey * sw + ex]); n++;
      }
      if (n && err / n < best.err) best = { err: err / n, s, dx, dy };
    }
  }
  // Full-res: edit resized by s, pixel (x,y) in orig = (x + dx*D, y + dy*D) in the edit.
  const fw = Math.round(w * best.s), fh = Math.round(h * best.s);
  const big = await sharp(edit).resize(fw, fh, { fit: "fill" }).toBuffer();
  const left = best.dx * D, top = best.dy * D;
  // Re-crop to the original's frame, padding any edge the offset uncovers.
  const padded = await sharp(big).extend({ top: 64, bottom: 64, left: 64, right: 64, extendWith: "copy" }).toBuffer();
  const aligned = await sharp(padded).extract({ left: left + 64, top: top + 64, width: w, height: h }).png().toBuffer();
  return { aligned, err: best.err };
}

async function recolorPanel(panel: Buffer, label: string): Promise<{ result: Buffer; note: string }> {
  const { width: w = 0, height: h = 0 } = await sharp(panel).metadata();
  const assetIn = await uploadLocalImageAsset(panel, `${basename(out, ".png")}-${label}-in.png`);
  const assetId = await generateSceneImage(assetIn, prompt, `${basename(out, ".png")}-${label}.png`, { model: "google/nano-banana-2.1", resolution });
  const edit    = await fetchWithRetry(await getImageAssetUrl(assetId), 6);
  const { aligned, err } = await align(panel, edit, w, h);
  const box = await locateFace(panel);
  if (!box) return { result: panel, note: `${label}: no face found, left unchanged` };
  // Eye band: the face box runs hairline to chin; the eyes sit ~30-55% down it,
  // but the box is loose on small faces (a full-body shot missed its eyes at 26%).
  const fx0 = box.x0 * w, fx1 = box.x1 * w, fy0 = box.y0 * h, fh = (box.y1 - box.y0) * h;
  const L = Math.max(0, Math.round(fx0 - 0.02 * w)), R = Math.min(w, Math.round(fx1 + 0.02 * w));
  const T = Math.max(0, Math.round(fy0 + 0.16 * fh)), B = Math.min(h, Math.round(fy0 + 0.6 * fh));
  const RW = R - L, RH = B - T, F = Math.max(4, Math.round(RH * 0.18));
  const svg = `<svg width="${RW}" height="${RH}"><defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${F / 2.5}"/></filter></defs><rect width="100%" height="100%" fill="black"/><ellipse cx="${RW / 2}" cy="${RH / 2}" rx="${RW / 2 - F}" ry="${RH / 2 - F}" fill="white" filter="url(#b)"/></svg>`;
  const mask = await sharp(Buffer.from(svg)).resize(RW, RH).extractChannel(0).raw().toBuffer();
  const rgb  = await sharp(aligned).extract({ left: L, top: T, width: RW, height: RH }).removeAlpha().raw().toBuffer();
  const rgba = Buffer.alloc(RW * RH * 4);
  for (let i = 0; i < RW * RH; i++) { rgba[i * 4] = rgb[i * 3]; rgba[i * 4 + 1] = rgb[i * 3 + 1]; rgba[i * 4 + 2] = rgb[i * 3 + 2]; rgba[i * 4 + 3] = mask[i]; }
  const result = await sharp(panel).composite([{ input: rgba, raw: { width: RW, height: RH, channels: 4 }, left: L, top: T }]).png().toBuffer();
  return { result, note: `${label}: edit ${assetId}, align err ${err.toFixed(1)}, eye band ${L},${T} ${RW}x${RH}` };
}

const source = readFileSync(resolve(ROOT, src));
const { width = 0, height = 0 } = await sharp(source).metadata();
const pw = Math.floor(width / cols), ph = Math.floor(height / rows);
const jobs = [];
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  jobs.push((async () => {
    const panel = await sharp(source).extract({ left: c * pw, top: r * ph, width: pw, height: ph }).png().toBuffer();
    return { left: c * pw, top: r * ph, ...(await recolorPanel(panel, `p${r * cols + c}`)) };
  })());
}
const done = await Promise.all(jobs);
for (const d of done) console.log(" ", d.note);
writeFileSync(resolve(ROOT, out), await sharp(source).composite(done.map((d) => ({ input: d.result, left: d.left, top: d.top }))).png().toBuffer());
console.log(`${src} -> ${out}`);
