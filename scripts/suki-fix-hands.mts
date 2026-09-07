#!/usr/bin/env -S npx tsx
/**
 * suki-fix-hands.mts
 * ────────────────────
 * One-off pose edit on the FINAL fixed hook/outro backdrop
 * (reference/Corporate Hallway Executive Portrait.png, Hedra asset id
 * e211b04b-a6b5-459a-ab52-3915b96cc353): her right hand is tucked in her
 * jacket pocket — this edits ONLY that, giving her both hands out of
 * pockets and relaxed/loose at her sides, so the per-clip performance
 * prompt has room to animate them (Hedra's avatar model anchors heavily on
 * the start frame's pose, confirmed during the facing-camera fix earlier
 * in this pipeline's history — a pocketed hand baked into the source photo
 * won't reliably un-pocket itself from the performance prompt alone).
 *
 * Uses google/nano-banana-pro (type: "image", not "image_to_image") —
 * user-designated default for "keep this exact background + add/adjust
 * this specific person" edits, since flux-kontext-pro-i2i's single-image
 * fidelity is good but nano-banana-pro tests consistently preserved
 * background/identity detail better for precise edits like this.
 *
 * Usage: npx tsx scripts/suki-fix-hands.mts
 * Requires HEDRA_API_KEY in .env.local.
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

const PROMPT = `Keep this exact photo unchanged in every respect — same woman, same face and identity, same brown leather jacket, same black tailored trousers, same black heels, same office reception hallway background, same navy/gold "AT" wall sign, same lighting, same camera framing and crop, same standing pose and leg position. The ONLY change: her right hand is currently tucked inside her jacket pocket — take it out. Both hands should now hang naturally relaxed and loose at her sides, out of the pockets, palms loosely open, mirroring each other, as if she just paused mid-gesture while talking. Do not add a bag, prop, or any other object to either hand. Do not change her expression, hair, or anything else in the frame.`;

async function main() {
  console.log("Uploading current backdrop as reference...");
  const srcBuf = readFileSync(resolve(ROOT, "reference", "Corporate Hallway Executive Portrait.png"));
  const refAssetId = await uploadLocalImageAsset(srcBuf, "suki-backdrop-current.png");
  console.log("reference asset id:", refAssetId);

  console.log("\nGenerating hands-out edit via google/nano-banana-pro...");
  const genRes = await fetchWithRetry(`${BASE}/generations`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      type:                "image",
      model_slug:          "google/nano-banana-pro",
      reference_image_ids: [refAssetId],
      text_prompt:         PROMPT,
      aspect_ratio:        "9:16",
      name:                "suki-backdrop-hands-out",
    }),
  });
  if (!genRes.ok) throw new Error(`Generation submit failed: ${genRes.status} ${await genRes.text()}`);
  const gen = await genRes.json() as { id: string };
  const status = await pollUntilDone(gen.id);
  if (status.status !== "complete" || !status.asset_id) {
    throw new Error(`Hands-out edit failed: ${status.error_message ?? "unknown error"}`);
  }

  const url = await getImageAssetUrl(status.asset_id);
  if (!url) throw new Error("No url for generated image");
  const res = await fetchWithRetry(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = resolve(ROOT, "reference", "suki-backdrop-hands-out.png");
  writeFileSync(outPath, buf);

  console.log("\nDone.");
  console.log("Saved:", outPath);
  console.log("Hedra image asset id (paste as introSceneImageAssetId):", status.asset_id);
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
