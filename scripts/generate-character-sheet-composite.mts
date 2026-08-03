#!/usr/bin/env -S npx tsx
/**
 * generate-character-sheet-composite.mts
 * ────────────────────────────────────────
 * Combines a persona's 7 separate Hedra character-sheet shots (each its own
 * image asset) into a single labeled contact-sheet PNG — one reference image
 * showing every angle/expression at once, instead of juggling 7 files.
 *
 * Usage:
 *   npx tsx scripts/generate-character-sheet-composite.mts <persona-key>
 *   npx tsx scripts/generate-character-sheet-composite.mts suki
 *
 * Requires HEDRA_API_KEY in .env.local. Output: reference/<key>-character-sheet.png
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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

const personaKey = process.argv[2];
if (!personaKey) {
  console.error("Usage: npx tsx scripts/generate-character-sheet-composite.mts <persona-key>");
  process.exit(1);
}

const { getCreatorPersona } = await import("../app/lib/social/creator-personas");

const BASE = "https://api.hedra.com/web-app/public";
function headers(): HeadersInit {
  const apiKey = process.env.HEDRA_API_KEY;
  if (!apiKey) throw new Error("HEDRA_API_KEY not set");
  return { "X-API-Key": apiKey };
}

async function getAssetUrl(assetId: string): Promise<string> {
  const res = await fetch(`${BASE}/assets?type=image&ids=${assetId}`, { headers: headers() });
  if (!res.ok) throw new Error(`GET /assets failed for ${assetId}: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as Array<{ asset?: { url?: string }; url?: string }>;
  const entry = data[0];
  const url = entry?.asset?.url ?? entry?.url;
  if (!url) throw new Error(`No url found for asset ${assetId}: ${JSON.stringify(entry)}`);
  return url;
}

const LABELS: Record<string, string> = {
  frontNeutral:        "Front — Neutral",
  threeQuarterNeutral: "3/4 — Neutral",
  profileNeutral:      "Profile — Neutral",
  frontSmiling:        "Front — Smiling",
  frontSerious:        "Front — Serious",
  fullBodyFront:       "Full Body — Front",
  fullBodySide:        "Full Body — Side",
};

const persona = getCreatorPersona(personaKey);
const sheet = persona.characterSheet ?? {};
const shots = Object.entries(sheet).filter(([, v]) => !!v) as Array<[string, string]>;

if (shots.length === 0) {
  console.error(`Persona "${personaKey}" has no characterSheet entries.`);
  process.exit(1);
}

console.log(`Building composite for ${persona.name} (${shots.length} shots)...`);

const CELL_W = 480;
const CELL_H = 640;
const LABEL_H = 40;
const PAD = 12;
const COLS = 4;
const rows = Math.ceil(shots.length / COLS);

const canvasW = COLS * CELL_W + (COLS + 1) * PAD;
const canvasH = rows * (CELL_H + LABEL_H) + (rows + 1) * PAD + 80;

const overlays: sharp.OverlayOptions[] = [];
const svgTexts: string[] = [];

for (let i = 0; i < shots.length; i++) {
  const [shotName, assetId] = shots[i];
  console.log(`  [${i + 1}/${shots.length}] ${shotName} (${assetId})...`);
  const url = await getAssetUrl(assetId);
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Failed to download ${shotName}: ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const resized = await sharp(buf)
    .resize(CELL_W, CELL_H, { fit: "cover" })
    .toBuffer();

  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = PAD + col * (CELL_W + PAD);
  const y = 80 + PAD + row * (CELL_H + LABEL_H + PAD);

  overlays.push({ input: resized, left: x, top: y });
  const label = LABELS[shotName] ?? shotName;
  svgTexts.push(
    `<text x="${x + CELL_W / 2}" y="${y + CELL_H + 28}" font-family="Arial, sans-serif" font-size="26" fill="#111" text-anchor="middle">${label}</text>`
  );
}

const titleSvg = `<text x="${canvasW / 2}" y="50" font-family="Arial, sans-serif" font-size="38" font-weight="bold" fill="#111" text-anchor="middle">${persona.name} — Character Reference Sheet</text>`;

const labelsSvg = `<svg width="${canvasW}" height="${canvasH}">${titleSvg}${svgTexts.join("")}</svg>`;

const base = sharp({
  create: {
    width: canvasW,
    height: canvasH,
    channels: 3,
    background: { r: 255, g: 255, b: 255 },
  },
});

const outDir = resolve(ROOT, "reference");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `${persona.key}-character-sheet.png`);

await base
  .composite([...overlays, { input: Buffer.from(labelsSvg), left: 0, top: 0 }])
  .png()
  .toFile(outPath);

console.log(`\nDone: ${outPath}`);
