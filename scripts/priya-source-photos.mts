#!/usr/bin/env -S npx tsx
/**
 * priya-source-photos.mts
 * ────────────────────────
 * Rebuilds Priya's identity the way Suki's was made: a set of candid,
 * natural-light lifestyle photos generated with google/nano-banana-pro from
 * a ChatGPT/gpt-image reference (for Priya, the Higgsfield "Heart" portrait
 * and its three-quarter shot, both gpt-image). Suki's equivalents are
 * reference/Suki 1-7.png, which later seeded her character sheet.
 *
 * Each shot costs one nano-banana-pro image (~15 Hedra credits). Saved as
 * reference/priya/source/Priya <n>.png, with each Hedra asset id printed.
 *
 * Usage (from project root):
 *   npx tsx scripts/priya-source-photos.mts [shot numbers, e.g. 2 5]
 *
 * Requires HEDRA_API_KEY in .env.local.
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

const { uploadLocalImageAsset, generateSceneImage } = await import("../app/lib/social/hedra-client");

const REFS = ["reference/priya/priya-curly-2-heart.png", "reference/priya/heart-threequarter.png"];

const IDENTITY =
  "The reference images show one woman. Reproduce her exactly: the same face shape, light grey eyes, " +
  "eyebrows, nose, lips, jawline, warm brown skin tone, long voluminous black ringlet curls and curvy " +
  "hourglass figure. She must be unmistakably the same person. Use the references only for who she is, " +
  "not for their studio lighting, makeup or clothes.";

const LOOK =
  "Her signature outfit: a burgundy satin wrap blouse with long sleeves and a fitted black pencil skirt, " +
  "carrying a black leather tote bag on one shoulder. Light, natural everyday makeup: no heavy eyeliner " +
  "or kohl, soft matte lips.";

const FINISH =
  "A candid, real photograph taken on a professional camera with natural light: real skin texture with " +
  "fine pores and subtle imperfections, not airbrushed, not retouched, not glossy, not a studio portrait, " +
  "not CGI. Shallow depth of field, background softly out of focus. No text overlays, no watermark.";

const SHOTS = [
  "Sitting sideways on a low stone wall along a riverside walking path in golden late-afternoon sun, one hand resting on the wall beside her, smiling warmly at the camera. Framed from the head down to her knees.",
  "Standing in front of a small café's glass shopfront on a city street, arms loosely crossed, a relaxed confident half-smile, looking straight into the camera. Framed from the head down to her hips.",
  "Standing beside a tall window in a bright modern office corridor in daylight, giving a friendly little wave with one hand at shoulder height, smiling at the camera. Framed from the head down to her waist.",
  "Walking through a bright, airy office atrium with big windows, glancing off to her left with a natural smile, mid-step, candid. Framed from the head down to her hips.",
  "Leaning lightly against a railing on a city riverside promenade in soft evening light, a calm, warm, closed-mouth smile at the camera. Framed from the head down to her knees.",
  "Standing at a busy train station concourse, looking off to one side and laughing at something out of frame, one hand on the strap of her tote. Framed from the head down to her waist.",
  "A close head-and-shoulders portrait in soft window light in a quiet café, looking straight into the camera with a gentle, relaxed expression.",
];

const pick = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= SHOTS.length);
const shots = pick.length ? pick : SHOTS.map((_, i) => i + 1);

const outDir = resolve(ROOT, "reference", "priya", "source");
mkdirSync(outDir, { recursive: true });

const refIds: string[] = [];
for (const ref of REFS) refIds.push(await uploadLocalImageAsset(readFileSync(resolve(ROOT, ref)), ref.split("/").pop()!));
console.log("References:", refIds.join(", "));

const results = await Promise.allSettled(shots.map(async (n) => {
  const assetId = await generateSceneImage(refIds, `${IDENTITY} ${SHOTS[n - 1]} ${LOOK} ${FINISH}`, `priya-source-${n}.png`);
  const res = await fetch(`https://api.hedra.com/web-app/public/assets?type=image&ids=${assetId}`, {
    headers: { "X-API-Key": process.env.HEDRA_API_KEY! },
  });
  const [asset] = await res.json() as Array<{ asset?: { url?: string } }>;
  if (!asset?.asset?.url) throw new Error(`No url for ${assetId}`);
  writeFileSync(resolve(outDir, `Priya ${n}.png`), Buffer.from(await (await fetch(asset.asset.url)).arrayBuffer()));
  return `Priya ${n}.png  asset ${assetId}`;
}));
results.forEach((r, i) => console.log(r.status === "fulfilled" ? r.value : `Priya ${shots[i]}: FAILED ${r.reason}`));
