#!/usr/bin/env -S npx tsx
/**
 * priya-identity-candidates.mts
 * ──────────────────────────────
 * Generates base-identity portrait candidates for Priya Mehta (Global Office
 * creator persona) from text alone — she has no real source photos the way
 * Suki did. The user picks one, which then seeds her character sheet.
 *
 * Plain white tee / black trousers on a neutral studio backdrop, same
 * convention as Suki's character sheet, so the identity stays outfit-swappable.
 *
 * Spends Hedra credits (~15 per candidate, google/nano-banana-pro).
 *
 * Usage (from project root):
 *   npx tsx scripts/priya-identity-candidates.mts [count]
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
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
const H = { "X-API-Key": process.env.HEDRA_API_KEY ?? "", "Content-Type": "application/json" };

const IDENTITY =
  "Photorealistic studio portrait photograph of Priya Mehta, a beautiful 27-year-old Indian woman " +
  "with warm caramel-brown skin, strikingly large almond-shaped light grey eyes, well-defined dark " +
  "eyebrows, high cheekbones, a straight nose, full lips and a bright confident expression. Long, " +
  "glossy, wavy black hair falling past her shoulders. Curvy hourglass figure with a full bust and " +
  "defined waist. Wearing a plain fitted white crew-neck t-shirt and black tailored trousers, no " +
  "jewellery, light natural makeup. Standing, framed from mid-thigh up, facing the camera directly, " +
  "arms relaxed at her sides, looking straight into the lens. Plain light-grey seamless studio " +
  "backdrop, soft even key light, sharp focus on the face, natural skin texture, no text, no logos.";

const VARIANTS = [
  "Hair parted in the centre. Soft closed-mouth smile.",
  "Hair swept over her left shoulder with a side part. Warm smile showing a little of her teeth.",
  "Hair parted slightly off-centre, volume at the crown. Calm, poised, neutral expression.",
  "Loose beachy waves with a deep side part. Subtle, knowing half-smile.",
];

const count = Math.min(Number(process.argv[2] ?? VARIANTS.length), VARIANTS.length);
const outDir = resolve(ROOT, "reference", "priya");
mkdirSync(outDir, { recursive: true });

async function generate(i: number) {
  const res = await fetch(`${BASE}/generations`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      type:         "image",
      model_slug:   "google/nano-banana-pro",
      text_prompt:  `${IDENTITY} ${VARIANTS[i]}`,
      aspect_ratio: "9:16",
      name:         `priya-candidate-${i + 1}`,
    }),
  });
  if (!res.ok) throw new Error(`candidate ${i + 1}: POST failed ${res.status} ${await res.text()}`);
  const gen = (await res.json()) as { id: string };

  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    const s = await (await fetch(`${BASE}/generations/${gen.id}/status`, { headers: H })).json() as {
      status: string; asset_id?: string; url?: string; download_url?: string; error_message?: string;
    };
    if (s.status === "error") throw new Error(`candidate ${i + 1}: ${s.error_message}`);
    if (s.status === "complete") {
      const url = s.download_url ?? s.url;
      if (url) {
        const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
        writeFileSync(resolve(outDir, `priya-candidate-${i + 1}.png`), buf);
      }
      console.log(`candidate ${i + 1}: asset ${s.asset_id}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`candidate ${i + 1}: timed out`);
}

const results = await Promise.allSettled(Array.from({ length: count }, (_, i) => generate(i)));
for (const r of results) if (r.status === "rejected") console.error(String(r.reason));
console.log(`\nSaved to ${outDir}`);
