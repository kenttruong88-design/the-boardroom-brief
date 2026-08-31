#!/usr/bin/env -S npx tsx
/**
 * suki-charsheet-compose.mts
 * ─────────────────────────────
 * Composes the generated panels (from suki-charsheet-generate.mts) into a
 * single flat editorial character-reference-sheet PNG per candidate, in the
 * style of reference/charasheet reference.jpg. Pure local image math (sharp)
 * — no API calls, free to re-run/tweak layout.
 *
 * Usage: npx tsx scripts/suki-charsheet-compose.mts
 */

import sharp from "sharp";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");

const W = 2400;
const MARGIN = 70;
const INK = "#1a1512";
const SUB = "#6b6058";
const RULE = "#d8d2c8";
const PAPER = "#faf8f5";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function getAvgHex(filePath: string, left: number, top: number, width: number, height: number): Promise<string> {
  const { data } = await sharp(filePath)
    .extract({ left, top, width, height })
    .resize(1, 1)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [r, g, b] = data;
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

interface Thumb { input: Buffer; left: number; top: number; width: number; height: number; }

async function thumb(filePath: string, left: number, top: number, width: number, height: number): Promise<Thumb> {
  const input = await sharp(filePath).resize(width, height, { fit: "cover" }).png().toBuffer();
  return { input, left, top, width, height };
}

async function cropThumb(filePath: string, extract: { left: number; top: number; width: number; height: number }, outW: number, outH: number, left: number, top: number): Promise<Thumb> {
  const input = await sharp(filePath).extract(extract).resize(outW, outH, { fit: "cover" }).png().toBuffer();
  return { input, left, top, width: outW, height: outH };
}

const PROFILE = {
  name: "Suki Nakamura",
  role: "Out of Office Correspondent, The Alignment Times",
  age: "Early 30s",
  height: "5'6\" (168cm)",
  bodyType: "Slim, average build",
  personality: "Warm, curious, wry, well-travelled, quietly confident",
  traits: [
    "Long wavy dark brown hair, center part",
    "Warm brown eyes, soft natural brows",
    "Warm olive-tan skin tone",
    "Small stud earrings, no visible tattoos",
    "Natural, lightly dewy makeup",
  ],
};

const CANDIDATES = [
  { key: "suki3", sourceLabel: "Base photo: Suki 3 (storefront, arms crossed)" },
  { key: "suki5", sourceLabel: "Base photo: Suki 5 (window light, waving)" },
];

const EXPRESSIONS: [string, string][] = [
  ["expr_neutral", "Neutral"], ["expr_happy", "Happy"], ["expr_angry", "Angry"], ["expr_sad", "Sad"],
  ["expr_surprised", "Surprised"], ["expr_worried", "Worried"], ["expr_confident", "Confident"], ["expr_determined", "Determined"],
];
const POSES: [string, string][] = [
  ["pose_neutralStanding", "Neutral Standing"], ["pose_walking", "Walking"], ["pose_sitting", "Sitting"],
  ["pose_relaxed", "Relaxed"], ["pose_tense", "Tense"], ["pose_actionReady", "Action-Ready"],
];
const TURNAROUND: [string, string][] = [
  ["turnaround_front", "Front"], ["turnaround_threeQuarter", "3/4 View"], ["turnaround_side", "Side"], ["turnaround_back", "Back"],
];
const FACE: [string, string][] = [
  ["face_front", "Front"], ["face_threeQuarter", "3/4 View"], ["face_profile", "Profile (Side)"],
];

for (const { key, sourceLabel } of CANDIDATES) {
  const dir = resolve(ROOT, "reference", "charsheet", key);
  const p = (name: string) => resolve(dir, `${name}.png`);
  if (!existsSync(p("turnaround_front"))) { console.log(`[${key}] missing panels, skipping`); continue; }

  console.log(`\n[${key}] composing...`);

  // ── Layout math ──────────────────────────────────────────────────────────
  let y = 0;
  const headerH = 190;
  y += headerH;

  const rowATop = y + 40;
  const profileW = 620;
  const taGap = 15;
  const taW = Math.floor((W - MARGIN * 2 - profileW - 40 - taGap * 3) / 4);
  const taH = Math.round(taW * 1184 / 880);
  const rowAH = Math.max(520, taH + 60) + 40;
  y = rowATop + rowAH;

  const rowBTop = y + 10;
  const faceGap = 15;
  const faceColW = 1130;
  const faceW = Math.floor((faceColW - faceGap * 2) / 3);
  const faceH = Math.round(faceW * 1184 / 880);
  const rowBH = Math.max(faceH + 60, 380) + 40;
  y = rowBTop + rowBH;

  const rowCTop = y + 10;
  const exprGap = 15;
  const exprW = Math.floor((W - MARGIN * 2 - exprGap * 7) / 8);
  const exprH = Math.round(exprW * 1184 / 880);
  const rowCH = exprH + 70;
  y = rowCTop + rowCH;

  const rowDTop = y + 10;
  const poseGap = 15;
  const poseW = Math.floor((W - MARGIN * 2 - poseGap * 5) / 6);
  const poseH = Math.round(poseW * 1184 / 880);
  const rowDH = poseH + 70;
  y = rowDTop + rowDH;

  const rowETop = y + 10;
  const costW = 380;
  const costH = 380;
  const costGap = 15;
  const rowEH = costH + 70;
  y = rowETop + rowEH;

  const rowFTop = y + 10;
  const swW = 220, swH = 130;
  const rowFH = swH + 70;
  y = rowFTop + rowFH;

  const rowGTop = y + 10;
  const rowGH = 150;
  y = rowGTop + rowGH;

  const totalH = y + MARGIN;

  // ── Composite thumbnails ────────────────────────────────────────────────
  const composites: Thumb[] = [];

  let tx = MARGIN + profileW + 40;
  for (const [file, _label] of TURNAROUND) {
    composites.push(await thumb(p(file), tx, rowATop, taW, taH));
    tx += taW + taGap;
  }

  let fx = MARGIN;
  for (const [file, _label] of FACE) {
    composites.push(await thumb(p(file), fx, rowBTop, faceW, faceH));
    fx += faceW + faceGap;
  }

  let ex = MARGIN;
  for (const [file, _label] of EXPRESSIONS) {
    composites.push(await thumb(p(file), ex, rowCTop, exprW, exprH));
    ex += exprW + exprGap;
  }

  let px = MARGIN;
  for (const [file, _label] of POSES) {
    composites.push(await thumb(p(file), px, rowDTop, poseW, poseH));
    px += poseW + poseGap;
  }

  const costumeCrops: [string, { left: number; top: number; width: number; height: number }, string][] = [
    ["turnaround_front", { left: 370, top: 250, width: 220, height: 220 }, "Collar & Buttons"],
    ["turnaround_front", { left: 420, top: 380, width: 140, height: 140 }, "Fabric Close-up"],
    ["turnaround_front", { left: 300, top: 500, width: 280, height: 160 }, "Pocket Flaps"],
    ["turnaround_front", { left: 260, top: 1060, width: 340, height: 124 }, "Footwear"],
    ["turnaround_back", { left: 200, top: 350, width: 340, height: 340 }, "Bag & Back"],
  ];
  let cx = MARGIN;
  for (const [file, extract, _label] of costumeCrops) {
    composites.push(await cropThumb(p(file), extract, costW, costH, cx, rowETop));
    cx += costW + costGap;
  }

  // ── Sample palette colors from face_front ───────────────────────────────
  const skinHex = await getAvgHex(p("face_front"), 430, 335, 45, 45);
  const hairHex = await getAvgHex(p("face_front"), 380, 70, 90, 60);
  const jacketHex = await getAvgHex(p("turnaround_front"), 300, 700, 60, 60);
  const bgHex = await getAvgHex(p("face_front"), 20, 20, 60, 60);

  // ── Build the text/vector overlay SVG ───────────────────────────────────
  const svgParts: string[] = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}">`);

  // Header
  svgParts.push(`<text x="${MARGIN}" y="70" font-family="Georgia, serif" font-size="46" font-weight="700" fill="${INK}">CHARACTER REFERENCE SHEET</text>`);
  svgParts.push(`<text x="${MARGIN}" y="112" font-family="Arial, sans-serif" font-size="26" fill="${SUB}">Suki Nakamura — candidate ${esc(key.replace("suki", "Suki "))} — ${esc(sourceLabel)}</text>`);
  svgParts.push(`<line x1="${MARGIN}" y1="140" x2="${W - MARGIN}" y2="140" stroke="${RULE}" stroke-width="2"/>`);

  // Row A: profile text + section label
  svgParts.push(`<text x="${MARGIN}" y="${rowATop - 10}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${INK}">1. CHARACTER PROFILE</text>`);
  svgParts.push(`<text x="${MARGIN + profileW + 40}" y="${rowATop - 10}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${INK}">2. FULL-BODY TURNAROUND</text>`);
  {
    let ty = rowATop + 30;
    const line = (label: string, val: string, size = 20, gap = 34) => {
      svgParts.push(`<text x="${MARGIN}" y="${ty}" font-family="Arial, sans-serif" font-size="15" fill="${SUB}" letter-spacing="1">${esc(label).toUpperCase()}</text>`);
      ty += 24;
      svgParts.push(`<text x="${MARGIN}" y="${ty}" font-family="Arial, sans-serif" font-size="${size}" fill="${INK}">${esc(val)}</text>`);
      ty += gap;
    };
    line("Name", PROFILE.name);
    line("Role", PROFILE.role, 18);
    line("Approx. Age", PROFILE.age);
    line("Height", PROFILE.height);
    line("Body Type", PROFILE.bodyType);
    line("Personality", PROFILE.personality, 18, 38);
    svgParts.push(`<text x="${MARGIN}" y="${ty}" font-family="Arial, sans-serif" font-size="15" fill="${SUB}" letter-spacing="1">DISTINCTIVE TRAITS</text>`);
    ty += 26;
    for (const t of PROFILE.traits) {
      svgParts.push(`<text x="${MARGIN}" y="${ty}" font-family="Arial, sans-serif" font-size="17" fill="${INK}">• ${esc(t)}</text>`);
      ty += 25;
    }
  }
  // turnaround labels
  {
    let lx = MARGIN + profileW + 40;
    for (const [, label] of TURNAROUND) {
      svgParts.push(`<text x="${lx + taW / 2}" y="${rowATop + taH + 26}" font-family="Arial, sans-serif" font-size="17" fill="${INK}" text-anchor="middle">${esc(label)}</text>`);
      lx += taW + taGap;
    }
  }

  // Row B: face identity + notes
  svgParts.push(`<line x1="${MARGIN}" y1="${rowBTop - 26}" x2="${W - MARGIN}" y2="${rowBTop - 26}" stroke="${RULE}" stroke-width="2"/>`);
  svgParts.push(`<text x="${MARGIN}" y="${rowBTop - 4}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${INK}">3. FACE AND IDENTITY DETAILS</text>`);
  {
    let lx = MARGIN;
    for (const [, label] of FACE) {
      svgParts.push(`<text x="${lx + faceW / 2}" y="${rowBTop + faceH + 26}" font-family="Arial, sans-serif" font-size="17" fill="${INK}" text-anchor="middle">${esc(label)}</text>`);
      lx += faceW + faceGap;
    }
  }
  {
    const notesX = MARGIN + faceColW + 40;
    svgParts.push(`<text x="${notesX}" y="${rowBTop + 16}" font-family="Arial, sans-serif" font-size="15" fill="${SUB}" letter-spacing="1">IDENTITY NOTES</text>`);
    const notes = [
      "Eye Color: Warm Brown", "Hair Color: Dark Brown", "Skin Tone: Warm Olive-Tan",
      "Eyebrows: Soft, naturally shaped", "Nose: Straight, refined", "Lips: Full, natural mauve",
      "Makeup: Natural, light enhancement", "Facial Shape: Oval", "No visible scars or tattoos; small stud earrings",
    ];
    let ny = rowBTop + 46;
    for (const n of notes) {
      svgParts.push(`<text x="${notesX}" y="${ny}" font-family="Arial, sans-serif" font-size="18" fill="${INK}">• ${esc(n)}</text>`);
      ny += 30;
    }
  }

  // Row C: expression sheet
  svgParts.push(`<line x1="${MARGIN}" y1="${rowCTop - 26}" x2="${W - MARGIN}" y2="${rowCTop - 26}" stroke="${RULE}" stroke-width="2"/>`);
  svgParts.push(`<text x="${MARGIN}" y="${rowCTop - 4}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${INK}">4. EXPRESSION SHEET</text>`);
  {
    let lx = MARGIN;
    for (const [, label] of EXPRESSIONS) {
      svgParts.push(`<text x="${lx + exprW / 2}" y="${rowCTop + exprH + 26}" font-family="Arial, sans-serif" font-size="14" fill="${INK}" text-anchor="middle">${esc(label)}</text>`);
      lx += exprW + exprGap;
    }
  }

  // Row D: pose sheet
  svgParts.push(`<line x1="${MARGIN}" y1="${rowDTop - 26}" x2="${W - MARGIN}" y2="${rowDTop - 26}" stroke="${RULE}" stroke-width="2"/>`);
  svgParts.push(`<text x="${MARGIN}" y="${rowDTop - 4}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${INK}">5. POSE AND BODY LANGUAGE</text>`);
  {
    let lx = MARGIN;
    for (const [, label] of POSES) {
      svgParts.push(`<text x="${lx + poseW / 2}" y="${rowDTop + poseH + 26}" font-family="Arial, sans-serif" font-size="16" fill="${INK}" text-anchor="middle">${esc(label)}</text>`);
      lx += poseW + poseGap;
    }
  }

  // Row E: costume details
  svgParts.push(`<line x1="${MARGIN}" y1="${rowETop - 26}" x2="${W - MARGIN}" y2="${rowETop - 26}" stroke="${RULE}" stroke-width="2"/>`);
  svgParts.push(`<text x="${MARGIN}" y="${rowETop - 4}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${INK}">6. COSTUME DETAILS</text>`);
  {
    let lx = MARGIN;
    for (const [, , label] of costumeCrops) {
      svgParts.push(`<text x="${lx + costW / 2}" y="${rowETop + costH + 26}" font-family="Arial, sans-serif" font-size="16" fill="${INK}" text-anchor="middle">${esc(label)}</text>`);
      lx += costW + costGap;
    }
  }

  // Row F: color & material palette
  svgParts.push(`<line x1="${MARGIN}" y1="${rowFTop - 26}" x2="${W - MARGIN}" y2="${rowFTop - 26}" stroke="${RULE}" stroke-width="2"/>`);
  svgParts.push(`<text x="${MARGIN}" y="${rowFTop - 4}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${INK}">7. COLOR AND MATERIAL PALETTE</text>`);
  {
    const swatches: [string, string][] = [
      [skinHex, "Skin"], [hairHex, "Hair"], [jacketHex, "Jacket Fabric"], [bgHex, "Studio Backdrop"],
      ["#2b2420", "Trousers/Bag (approx.)"],
    ];
    let sx = MARGIN;
    for (const [hex, label] of swatches) {
      svgParts.push(`<rect x="${sx}" y="${rowFTop}" width="${swW}" height="${swH}" fill="${hex}" stroke="${RULE}" stroke-width="1"/>`);
      svgParts.push(`<text x="${sx}" y="${rowFTop + swH + 26}" font-family="Arial, sans-serif" font-size="16" fill="${INK}">${esc(label)}</text>`);
      svgParts.push(`<text x="${sx}" y="${rowFTop + swH + 48}" font-family="Consolas, monospace" font-size="15" fill="${SUB}">${hex.toUpperCase()}</text>`);
      sx += swW + 40;
    }
  }

  // Row G: do not change note
  svgParts.push(`<line x1="${MARGIN}" y1="${rowGTop - 26}" x2="${W - MARGIN}" y2="${rowGTop - 26}" stroke="${RULE}" stroke-width="2"/>`);
  svgParts.push(`<text x="${MARGIN}" y="${rowGTop - 4}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${INK}">8. DO NOT CHANGE</text>`);
  svgParts.push(`<text x="${MARGIN}" y="${rowGTop + 34}" font-family="Arial, sans-serif" font-size="18" fill="${INK}">Lock this character's face, identity, skin tone, age, hair, eye color, body shape, proportions, costume, accessories,</text>`);
  svgParts.push(`<text x="${MARGIN}" y="${rowGTop + 62}" font-family="Arial, sans-serif" font-size="18" fill="${INK}">markings, colors, and defining features across every future generation. Do not redesign, beautify, age, stylize,</text>`);
  svgParts.push(`<text x="${MARGIN}" y="${rowGTop + 90}" font-family="Arial, sans-serif" font-size="18" fill="${INK}">simplify, or create alternate versions.</text>`);

  svgParts.push(`</svg>`);
  const overlaySvg = svgParts.join("\n");

  const base = sharp({ create: { width: W, height: totalH, channels: 3, background: PAPER } });
  const overlayBuf = Buffer.from(overlaySvg);

  const outPath = resolve(ROOT, "reference", `suki-charsheet-${key}.png`);
  await base
    .composite([
      ...composites.map((c) => ({ input: c.input, left: c.left, top: c.top })),
      { input: overlayBuf, left: 0, top: 0 },
    ])
    .png()
    .toFile(outPath);

  console.log(`[${key}] saved ${outPath} (${W}x${totalH})`);
}

console.log("\nDone.");
