#!/usr/bin/env -S npx tsx
/**
 * ugc-approve.mts
 * ────────────────────
 * Approves a drafted UGC video and submits all 5 Hedra avatar-video
 * generations (plus 5 scene images + 5 narrations) — SPENDS REAL HEDRA
 * CREDITS. Run ugc-review.mts first to read the script before approving.
 *
 * Usage (from project root):
 *   npx tsx scripts/ugc-approve.mts <queueId>
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
if (!queueId) {
  console.error("Usage: npx tsx scripts/ugc-approve.mts <queueId>");
  process.exit(1);
}

const { approveUgcVideo } = await import("../app/lib/social/ugc-video-generator");

console.log("Submitting 5 avatar-video generations (spends Hedra credits)...");
const row = await approveUgcVideo(queueId);

console.log("Status:", row.status);
for (const clip of row.clips) {
  console.log(`[${clip.label}] status: ${clip.status}${clip.error ? ` — ${clip.error}` : ""}`);
}
console.log(`\nPoll progress: npx tsx scripts/ugc-status.mts ${row.id}`);
