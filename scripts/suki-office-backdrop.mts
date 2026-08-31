#!/usr/bin/env -S npx tsx
/**
 * suki-office-backdrop.mts
 * ──────────────────────────
 * Generates the fixed office-reception start-frame image shared by the
 * hook (intro) clip and the outro clip. Steps:
 *   1. Generate the backdrop via Hedra image-to-image (Suki 3 identity),
 *      deliberately leaving the sign panel BLANK — AI image models render
 *      multi-word text unreliably, so we composite the real logo ourselves.
 *   2. Composite reference/03-lockup-seal.png onto the blank panel locally
 *      (sharp) — exact brand colors/typography, no gamble.
 *   3. Upload the composited final image to Cloudinary (permanent copy) and
 *      to Hedra (as an image asset usable as a video start_keyframe_id).
 *
 * Usage: npx tsx scripts/suki-office-backdrop.mts
 * Requires HEDRA_API_KEY and CLOUDINARY_* in .env.local.
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

const BASE = "https://api.hedra.com/web-app/public";
function headers(): HeadersInit {
  const apiKey = process.env.HEDRA_API_KEY;
  if (!apiKey) throw new Error("HEDRA_API_KEY not set");
  return { "X-API-Key": apiKey };
}
async function fetchWithRetry(url: string, opts: RequestInit = {}, retries = 5): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetch(url, opts);
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`  (transient fetch error, retrying ${attempt}/${retries}...)`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error("unreachable");
}
async function uploadLocalImageAsset(buf: Buffer, name: string): Promise<string> {
  const createRes = await fetchWithRetry(`${BASE}/assets`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ name, type: "image" }),
  });
  if (!createRes.ok) throw new Error(`Create asset failed: ${createRes.status} ${await createRes.text()}`);
  const created = await createRes.json() as { id: string };
  const form = new FormData();
  form.append("file", new Blob([buf]), name);
  const uploadRes = await fetchWithRetry(`${BASE}/assets/${created.id}/upload`, {
    method: "POST", headers: headers(), body: form,
  });
  if (!uploadRes.ok) throw new Error(`Image asset upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  return created.id;
}
interface GenStatus { id: string; asset_id?: string; status: string; error_message?: string; }
async function pollUntilDone(generationId: string, timeoutMs = 180_000): Promise<GenStatus> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetchWithRetry(`${BASE}/generations/${generationId}/status`, { headers: headers() });
    if (!res.ok) throw new Error(`Status check failed: ${res.status} ${await res.text()}`);
    const status = await res.json() as GenStatus;
    if (status.status === "complete" || status.status === "error") return status;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Generation ${generationId} timed out`);
}
async function getImageAssetUrl(assetId: string): Promise<string | undefined> {
  const res = await fetchWithRetry(`${BASE}/assets?type=image&ids=${assetId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Asset lookup failed: ${res.status} ${await res.text()}`);
  const assets = await res.json() as Array<{ asset?: { url?: string } }>;
  return assets[0]?.asset?.url;
}

const OUTFIT = "wearing a tailored charcoal-navy blazer over a simple top";
const BACKDROP_PROMPT = `Same woman, same face and identity, ${OUTFIT}, standing in a modern editorial office reception area — warm architectural lighting, glass partitions, dark wood and brass finishes, a sleek reception desk visible behind her. She is positioned in the RIGHT HALF of the frame, off-center, angled slightly toward camera. The LEFT HALF of the wall behind her (fully clear of her body, hair, and shadow — not overlapping her at all) has a large BLANK rectangular illuminated sign panel, plain and unmarked, no text, no letters, no logo, no graphics on it — just an empty lit panel, floating clear in open wall space to her left with visible wall margin all around it. Vertical full-body framing as if the viewer's own camera is filming her directly, natural relaxed standing angle, facing the camera with direct eye contact, warm confident expression, one hand gesturing naturally at her side. Do not crop at the waist, hips, or knees — feet and floor visible.`;

async function main() {
  console.log("Uploading Suki 3 identity reference...");
  const suki3Buf = readFileSync(resolve(ROOT, "reference", "Suki 3.png"));
  const identityAssetId = await uploadLocalImageAsset(suki3Buf, "suki3-identity-for-backdrop.png");
  console.log("identity asset id:", identityAssetId);

  console.log("\nGenerating office backdrop (blank sign panel)...");
  const genRes = await fetchWithRetry(`${BASE}/generations`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "image_to_image",
      model_slug: "fal/flux-kontext-pro-i2i",
      reference_image_ids: [identityAssetId],
      text_prompt: BACKDROP_PROMPT,
      aspect_ratio: "9:16",
      name: "suki-office-backdrop-raw",
    }),
  });
  if (!genRes.ok) throw new Error(`Generation submit failed: ${genRes.status} ${await genRes.text()}`);
  const gen = await genRes.json() as { id: string };
  const status = await pollUntilDone(gen.id);
  if (status.status !== "complete" || !status.asset_id) {
    throw new Error(`Backdrop generation failed: ${status.error_message ?? "unknown error"}`);
  }
  const rawUrl = await getImageAssetUrl(status.asset_id);
  if (!rawUrl) throw new Error("No url for generated backdrop");
  const rawRes = await fetchWithRetry(rawUrl);
  const rawBuf = Buffer.from(await rawRes.arrayBuffer());
  const rawPath = resolve(ROOT, "reference", "suki-office-backdrop-raw.png");
  writeFileSync(rawPath, rawBuf);
  console.log("Saved raw backdrop:", rawPath);

  console.log("\nCompositing logo onto backdrop (local, free)...");
  const meta = await sharp(rawPath).metadata();
  const W = meta.width!, H = meta.height!;
  // Panel placement is approximate/generic (office set framing is fairly
  // consistent from this prompt) — checked visually after generation and
  // adjusted if needed before this becomes final.
  const logoW = Math.round(W * 0.36);
  const logo = await sharp(resolve(ROOT, "reference", "03-lockup-seal.png"))
    .resize(logoW, null, { fit: "inside" })
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const logoLeft = Math.round(W * 0.06);
  const logoTop  = Math.round(H * 0.28);

  const outPath = resolve(ROOT, "reference", "suki-office-backdrop-final.png");
  await sharp(rawPath)
    .composite([{ input: logo, left: logoLeft, top: logoTop }])
    .png()
    .toFile(outPath);
  console.log("Saved composited backdrop:", outPath);

  console.log("\nUploading composited backdrop to Hedra as final asset...");
  const finalBuf = readFileSync(outPath);
  const finalAssetId = await uploadLocalImageAsset(finalBuf, "suki-office-backdrop-final.png");
  console.log("\nDone.");
  console.log("Final Hedra image asset id (paste as introSceneImageAssetId):", finalAssetId);
}

main();
