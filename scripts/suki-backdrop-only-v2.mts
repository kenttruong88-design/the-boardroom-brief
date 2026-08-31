#!/usr/bin/env -S npx tsx
/**
 * suki-backdrop-only-v2.mts
 * ────────────────────────────
 * Second round of EMPTY office-reception backdrop candidates (no person),
 * via Hedra's pure text-to-image endpoint (type: "image", no reference).
 * Wall sign inspired by the real logo (navy/gold badge, serif "AT"
 * monogram, red T) but described in words, not composited.
 *
 * Usage: npx tsx scripts/suki-backdrop-only-v2.mts
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
function headers(): HeadersInit { return { "X-API-Key": process.env.HEDRA_API_KEY! }; }
async function fetchWithRetry(url: string, opts: RequestInit = {}, retries = 6): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try { return await fetch(url, opts); }
    catch (err) {
      if (attempt === retries) throw err;
      console.log(`  (transient fetch error, retrying ${attempt}/${retries}...)`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error("unreachable");
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
async function generateImage(prompt: string, name: string): Promise<GenStatus> {
  const res = await fetchWithRetry(`${BASE}/generations`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "image",
      model_slug: "fal/flux-kontext-pro-i2i",
      text_prompt: prompt,
      aspect_ratio: "9:16",
      name,
    }),
  });
  if (!res.ok) throw new Error(`Generation submit failed: ${res.status} ${await res.text()}`);
  const gen = await res.json() as { id: string };
  return pollUntilDone(gen.id);
}

const SIGN = `a square badge sign with a thin gold border on a deep navy background, containing a bold serif monogram "AT" (the A in dark navy-charcoal, the T in deep rust-red), softly backlit with a warm glow`;

const CANDIDATES: [string, string][] = [
  [
    "marble_pillar",
    `A modern editorial office reception, empty of people, photorealistic architectural photography, vertical composition. A wide light-grey marble accent wall with soft visible veining fills most of the frame, lit by a recessed ceiling downlight. Mounted centrally on the marble is ${SIGN}. To the left, dark-framed glass sliding doors open onto a softly blurred lounge area with a sofa and a potted plant. Light beige stone floor, warm ambient lighting throughout.`,
  ],
  [
    "wood_panel",
    `A modern editorial office reception, empty of people, photorealistic architectural photography, vertical composition. Warm walnut wood-panelled wall fills most of the frame, with fine brass trim seams. Mounted on the wood panel is ${SIGN}. A sleek dark-wood reception desk with a brass base is visible in the foreground to one side. Polished dark stone floor, warm low-key lighting.`,
  ],
  [
    "glass_atrium",
    `A modern editorial office reception with a bright glass atrium feel, empty of people, photorealistic architectural photography, vertical composition. Floor-to-ceiling glass walls and a light stone accent wall, plenty of natural daylight, a large potted fig tree in the corner. Mounted on the stone accent wall is ${SIGN}. Pale terrazzo floor, airy and bright mood.`,
  ],
];

async function main() {
  for (const [name, prompt] of CANDIDATES) {
    console.log(`\n[${name}] generating...`);
    const status = await generateImage(prompt, `backdrop-v2-${name}`);
    if (status.status !== "complete" || !status.asset_id) {
      console.log(`[${name}] FAILED: ${status.error_message ?? "unknown error"}`);
      continue;
    }
    const url = await getImageAssetUrl(status.asset_id);
    if (!url) { console.log(`[${name}] no url`); continue; }
    const res = await fetchWithRetry(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const outPath = resolve(ROOT, "reference", `backdrop-v2-${name}.png`);
    writeFileSync(outPath, buf);
    console.log(`[${name}] saved: ${outPath} (asset id: ${status.asset_id})`);
  }
}

main();
