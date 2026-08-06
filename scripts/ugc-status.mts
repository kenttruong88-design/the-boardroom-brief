#!/usr/bin/env -S npx tsx
/**
 * ugc-status.mts
 * ────────────────────
 * Polls Hedra for an approved UGC video's clips until all are complete (or
 * one fails), re-hosts finished clips on Cloudinary, and once every clip is
 * done, compiles the hard-cut splice + shared outro into one video and
 * prints the final link.
 *
 * Usage (from project root):
 *   npx tsx scripts/ugc-status.mts <queueId>
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
  console.error("Usage: npx tsx scripts/ugc-status.mts <queueId>");
  process.exit(1);
}

const { finalizeUgcVideo } = await import("../app/lib/social/ugc-video-generator");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

for (let i = 0; i < 60; i++) {
  const row = await finalizeUgcVideo(queueId);

  console.log(`[${i + 1}] status: ${row.status}`);
  for (const clip of row.clips) {
    console.log(`   [${clip.label}] ${clip.status}${clip.error ? ` — ${clip.error}` : ""}`);
  }

  if (row.status === "complete") {
    console.log("\nCompiled video:", row.compiled_video_url);
    process.exit(0);
  }
  if (row.status === "failed") {
    console.error("\nOne or more clips failed — see errors above.");
    process.exit(1);
  }

  await sleep(10000);
}

console.error("\nTimed out after 10 minutes of polling — run this script again to keep checking.");
process.exit(1);
