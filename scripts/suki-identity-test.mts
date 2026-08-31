#!/usr/bin/env -S npx tsx
/**
 * suki-identity-test.mts
 * ───────────────────────
 * One-off comparison tool for picking the base identity photo to build
 * Suki's refreshed character sheet from. NOT part of the production
 * pipeline — doesn't touch creator-personas.ts.
 *
 * Uploads 3 candidate local photos (reference/Suki 3.png, reference/Suki 1.png,
 * reference/Suki 5.png) as Hedra assets, runs one comparable test generation
 * per candidate (a clean front-facing neutral studio portrait), and prints
 * the resulting image URLs for side-by-side comparison.
 *
 * Usage: npx tsx scripts/suki-identity-test.mts
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

async function fetchWithRetry(url: string, opts: RequestInit = {}, retries = 4): Promise<Response> {
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

async function uploadLocalImageAsset(filePath: string, name: string): Promise<string> {
  const buf = readFileSync(filePath);
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
    method: "POST",
    headers: headers(),
    body: form,
  });
  if (!uploadRes.ok) throw new Error(`Image asset upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  return created.id;
}

interface GenStatus {
  id: string; asset_id?: string; status: string; url?: string; download_url?: string; error_message?: string;
}

async function pollUntilDone(generationId: string, timeoutMs = 120_000): Promise<GenStatus> {
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

async function generateTestPortrait(referenceAssetId: string, name: string): Promise<GenStatus> {
  const prompt = "Same woman, same face and identity, wearing a simple plain white t-shirt, front-facing straight-on portrait, head and shoulders, neutral relaxed expression, plain neutral light-grey background, even studio lighting, no props.";
  const res = await fetchWithRetry(`${BASE}/generations`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "image_to_image",
      model_slug: "fal/flux-kontext-pro-i2i",
      reference_image_ids: [referenceAssetId],
      text_prompt: prompt,
      aspect_ratio: "9:16",
      name,
    }),
  });
  if (!res.ok) throw new Error(`Generation submit failed: ${res.status} ${await res.text()}`);
  const gen = await res.json() as { id: string };
  return pollUntilDone(gen.id);
}

const CANDIDATES = [
  { label: "Suki 3 (arms crossed, storefront)", file: "Suki 3.png" },
  { label: "Suki 1 (park bench)",               file: "Suki 1.png" },
  { label: "Suki 5 (waving, window light)",      file: "Suki 5.png" },
];

for (const { label, file } of CANDIDATES) {
  const filePath = resolve(ROOT, "reference", file);
  console.log(`\n[${label}] uploading ${file}...`);
  const assetId = await uploadLocalImageAsset(filePath, file);
  console.log(`[${label}] asset id: ${assetId} — generating test portrait...`);
  const result = await generateTestPortrait(assetId, `suki-identity-test-${file}`);
  if (result.status !== "complete" || !result.asset_id) {
    console.log(`[${label}] FAILED: ${result.error_message ?? "unknown error"}`);
    continue;
  }
  const url = await getImageAssetUrl(result.asset_id);
  if (!url) {
    console.log(`[${label}] no url found for asset ${result.asset_id}`);
    continue;
  }
  console.log(`[${label}] url: ${url}`);
  const imgRes = await fetchWithRetry(url);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const outPath = resolve(ROOT, "reference", `identity-test-${file}`);
  writeFileSync(outPath, buf);
  console.log(`[${label}] saved to ${outPath}`);
}
