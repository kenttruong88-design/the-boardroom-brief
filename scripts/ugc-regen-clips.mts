#!/usr/bin/env -S npx tsx
/**
 * ugc-regen-clips.mts
 * ────────────────────
 * Re-runs specific clips on an already-approved UGC video queue row without
 * rewriting the script — keeps each clip's existing script/scene/captions,
 * just resubmits scene image + narration + avatar video for it. Spends
 * Hedra credits for each label given. Use this after fixing something in
 * the scene-generation/performance pipeline that only needs an existing
 * video's affected clips redone, not a whole fresh draft.
 *
 * Usage (from project root):
 *   npx tsx scripts/ugc-regen-clips.mts <queueId> <label> [label2 ...]
 *   labels: country_a_dos | country_a_donts | country_b_dos | country_b_donts | hook
 *
 * After this, poll with: npx tsx scripts/ugc-status.mts <queueId>
 */

import { readFileSync, existsSync } from "fs";
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

const queueId = process.argv[2];
const labels  = process.argv.slice(3);
const VALID_LABELS = ["hook", "country_a_dos", "country_a_donts", "country_b_dos", "country_b_donts"];

if (!queueId || labels.length === 0) {
  console.error("Usage: npx tsx scripts/ugc-regen-clips.mts <queueId> <label> [label2 ...]");
  console.error(`Labels: ${VALID_LABELS.join(", ")}`);
  process.exit(1);
}
for (const label of labels) {
  if (!VALID_LABELS.includes(label)) {
    console.error(`Unknown label "${label}". Valid: ${VALID_LABELS.join(", ")}`);
    process.exit(1);
  }
}

const { regenerateClips } = await import("../app/lib/social/ugc-video-generator");

console.log(`Resubmitting: ${labels.join(", ")} (spends Hedra credits)...`);
const row = await regenerateClips(queueId, labels as any);
console.log("Status:", row.status);
for (const clip of row.clips) {
  console.log(`   [${clip.label}] ${clip.status}${clip.error ? ` — ${clip.error}` : ""}`);
}
console.log(`\nPoll progress: npx tsx scripts/ugc-status.mts ${queueId}`);
