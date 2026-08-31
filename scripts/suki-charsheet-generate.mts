#!/usr/bin/env -S npx tsx
/**
 * suki-charsheet-generate.mts
 * ─────────────────────────────
 * One-off documentation-sheet panel generator. NOT part of the production
 * pipeline — doesn't touch creator-personas.ts. Generates the full set of
 * panels (turnaround, face closeups, expressions, poses) needed to compose
 * an editorial character reference sheet for each of 2 candidate base
 * photos (Suki 3, Suki 5), so the user can compare full sheets before
 * picking one.
 *
 * Every panel is generated independently from the SAME uploaded candidate
 * photo (not chained from prior outputs) to avoid identity drift across
 * panels, matching the pattern in generate-character-sheet.mts.
 *
 * Usage: npx tsx scripts/suki-charsheet-generate.mts
 * Requires HEDRA_API_KEY in .env.local.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
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
      console.log(`    (transient fetch error, retrying ${attempt}/${retries}...)`);
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
  id: string; asset_id?: string; status: string; error_message?: string;
}

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

async function generatePanel(referenceAssetId: string, prompt: string, name: string): Promise<string> {
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
  const status = await pollUntilDone(gen.id);
  if (status.status !== "complete" || !status.asset_id) {
    throw new Error(`Panel generation failed: ${status.error_message ?? "unknown error"}`);
  }
  const url = await getImageAssetUrl(status.asset_id);
  if (!url) throw new Error(`No url for asset ${status.asset_id}`);
  return url;
}

// ── Wardrobe + backdrop constants ───────────────────────────────────────────

const OUTFIT_BODY = "wearing a brown structured single-breasted shacket-style jacket with double flap chest pockets and dark buttons over a plain top and dark trousers, carrying a dark brown woven-leather crossbody bag on one shoulder";
const OUTFIT_FACE = "wearing a brown structured shacket-style jacket with a collar, visible at the shoulders";
const BACKDROP = "plain neutral light-grey studio background, even soft studio lighting, no props";
const FULL_LENGTH = "FULL-LENGTH head-to-toe fashion catalog photograph, entire body visible from the top of her head down to her shoes and the floor beneath her feet, standing several steps back from the camera so there is visible empty space above her head and below her feet in the frame. Do not crop at the waist, hips, or knees — the shoes and floor must be visible.";

const PANELS: Record<string, string> = {
  // Full-body turnaround
  turnaround_front:        `Same woman, same face and identity, ${OUTFIT_BODY}, ${FULL_LENGTH} Front-facing standing pose, arms relaxed at sides, neutral relaxed expression, ${BACKDROP}`,
  turnaround_threeQuarter: `Same woman, same face and identity, ${OUTFIT_BODY}, ${FULL_LENGTH} Body turned about 45 degrees in a three-quarter standing pose, arms relaxed at sides, neutral relaxed expression, ${BACKDROP}`,
  turnaround_side:         `Same woman, same face and identity, ${OUTFIT_BODY}, ${FULL_LENGTH} Her ENTIRE BODY — shoulders, hips, and feet — is rotated 90 degrees to face sideways, a true side silhouette, one shoulder toward camera and one away, both feet pointing the same sideways direction. This is NOT a front-facing body with just the head turned. Arms relaxed at sides, neutral expression, ${BACKDROP}`,
  turnaround_back:         `Same woman, same hair, ${OUTFIT_BODY}, full-length fashion catalog rear-view photograph, camera positioned behind her, showing the back of her hair, jacket, and bag strap, standing pose, arms relaxed at sides, feet and floor visible, ${BACKDROP}`,
  // Face and identity
  face_front:        `Same woman, same face and identity, ${OUTFIT_FACE}, front-facing straight-on portrait, head and shoulders, neutral relaxed expression, ${BACKDROP}`,
  face_threeQuarter: `Same woman, same face and identity, ${OUTFIT_FACE}, three-quarter angle portrait (head turned about 45 degrees), head and shoulders, neutral relaxed expression, ${BACKDROP}`,
  face_profile:      `Same woman, same face and identity, ${OUTFIT_FACE}, full side profile portrait, head and shoulders, neutral relaxed expression, ${BACKDROP}`,
  // Expression sheet — keep the same exact bone structure/nose/eyebrow shape
  // and only shift it with a SUBTLE muscular change. Full theatrical
  // expressions (deep frowns, wide-open mouths) gave the model enough
  // license to reinterpret the underlying face shape, causing visible
  // identity drift between panels — confirmed by a side-by-side comparison
  // where neutral/happy (closest to the reference photo's own expression)
  // held identity but angry/sad/surprised/worried/determined did not.
  expr_neutral:    `Same woman, EXACT same face, bone structure, nose shape, eyebrow shape, and mouth shape as the reference photo, ${OUTFIT_FACE}, front-facing head-and-shoulders portrait, neutral relaxed expression, ${BACKDROP}`,
  expr_happy:      `Same woman, EXACT same face, bone structure, nose shape, eyebrow shape, and mouth shape as the reference photo, ${OUTFIT_FACE}, front-facing head-and-shoulders portrait, warm genuine happy smiling expression, ${BACKDROP}`,
  expr_angry:      `Same woman, EXACT same face, bone structure, nose shape, eyebrow shape, and mouth shape as the reference photo — do not change the underlying face, only the muscles, ${OUTFIT_FACE}, front-facing head-and-shoulders portrait, a subtle hint of irritation, slightly tightened brow, otherwise composed, ${BACKDROP}`,
  expr_sad:        `Same woman, EXACT same face, bone structure, nose shape, eyebrow shape, and mouth shape as the reference photo — do not change the underlying face, only the muscles, ${OUTFIT_FACE}, front-facing head-and-shoulders portrait, a subtle downcast, wistful expression, otherwise composed, ${BACKDROP}`,
  expr_surprised:  `Same woman, EXACT same face, bone structure, nose shape, eyebrow shape, and mouth shape as the reference photo — do not change the underlying face, only the muscles, ${OUTFIT_FACE}, front-facing head-and-shoulders portrait, a subtle look of mild surprise, slightly raised eyebrows, otherwise composed, ${BACKDROP}`,
  expr_worried:    `Same woman, EXACT same face, bone structure, nose shape, eyebrow shape, and mouth shape as the reference photo — do not change the underlying face, only the muscles, ${OUTFIT_FACE}, front-facing head-and-shoulders portrait, a subtle, quietly worried expression, otherwise composed, ${BACKDROP}`,
  expr_confident:  `Same woman, EXACT same face, bone structure, nose shape, eyebrow shape, and mouth shape as the reference photo, ${OUTFIT_FACE}, front-facing head-and-shoulders portrait, confident self-assured expression, slight knowing smile, ${BACKDROP}`,
  expr_determined: `Same woman, EXACT same face, bone structure, nose shape, eyebrow shape, and mouth shape as the reference photo — do not change the underlying face, only the muscles, ${OUTFIT_FACE}, front-facing head-and-shoulders portrait, a subtle, focused, determined expression, otherwise composed, ${BACKDROP}`,
  // Pose and body language
  pose_neutralStanding: `Same woman, same face and identity, ${OUTFIT_BODY}, ${FULL_LENGTH} Neutral standing pose, arms relaxed at sides, ${BACKDROP}`,
  pose_walking:         `Same woman, same face and identity, ${OUTFIT_BODY}, ${FULL_LENGTH} Mid-stride walking pose, natural arm swing, ${BACKDROP}`,
  pose_sitting:         `Same woman, same face and identity, ${OUTFIT_BODY}, entire body visible, seated pose on a simple stool, hands resting in lap, ${BACKDROP}`,
  pose_relaxed:         `Same woman, same face and identity, ${OUTFIT_BODY}, ${FULL_LENGTH} Relaxed casual standing pose, weight shifted on one leg, arms loosely crossed, ${BACKDROP}`,
  pose_tense:           `Same woman, same face and identity, ${OUTFIT_BODY}, ${FULL_LENGTH} Tense guarded standing pose, arms crossed tightly, shoulders drawn up, ${BACKDROP}`,
  pose_actionReady:     `Same woman, same face and identity, ${OUTFIT_BODY}, ${FULL_LENGTH} Alert action-ready standing pose, weight forward on the balls of her feet, ${BACKDROP}`,
};

const CANDIDATES = [
  { key: "suki3", file: "Suki 3.png" },
  { key: "suki5", file: "Suki 5.png" },
];

for (const { key, file } of CANDIDATES) {
  const outDir = resolve(ROOT, "reference", "charsheet", key);
  mkdirSync(outDir, { recursive: true });

  console.log(`\n=== ${key} (${file}) ===`);
  const filePath = resolve(ROOT, "reference", file);
  console.log(`Uploading identity reference...`);
  const identityAssetId = await uploadLocalImageAsset(filePath, `${key}-identity.png`);
  console.log(`identity asset id: ${identityAssetId}`);

  const entries = Object.entries(PANELS);
  for (let i = 0; i < entries.length; i++) {
    const [panelName, prompt] = entries[i];
    const outPath = resolve(outDir, `${panelName}.png`);
    if (existsSync(outPath)) {
      console.log(`  [${i + 1}/${entries.length}] ${panelName} — already exists, skipping`);
      continue;
    }
    console.log(`  [${i + 1}/${entries.length}] ${panelName} — generating...`);
    try {
      const url = await generatePanel(identityAssetId, prompt, `${key}-${panelName}`);
      const imgRes = await fetchWithRetry(url);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      writeFileSync(outPath, buf);
      console.log(`  [${i + 1}/${entries.length}] ${panelName} — saved`);
    } catch (err) {
      console.log(`  [${i + 1}/${entries.length}] ${panelName} — FAILED: ${(err as Error).message}`);
    }
  }
}

console.log("\nAll done.");
