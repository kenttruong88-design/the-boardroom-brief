#!/usr/bin/env -S npx tsx
/**
 * ugc-draft.mts
 * ────────────────────
 * Manual trigger for step 1 of the Suki UGC pipeline: writes the 5-clip
 * script with Claude and queues a new `ugc_video_queue` row in
 * "pending_approval" — no Hedra credits spent. Run `ugc-review.mts` on the
 * printed queue id to read the script, then `ugc-approve.mts` when ready to
 * actually generate video (that step spends credits).
 *
 * Usage (from project root):
 *   npx tsx scripts/ugc-draft.mts <path-to-out-of-office-md> [articleUrl]
 *
 * articleUrl defaults to a thealignmenttimes.com/out-of-office/<slug> guess
 * if omitted — the article may not be live yet, this is just stored on the
 * queue row as a reference/CTA link and can be corrected later.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";
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

const file = process.argv[2];
if (!file) {
  console.error("Usage: npx tsx scripts/ugc-draft.mts <path-to-out-of-office-md> [articleUrl]");
  process.exit(1);
}

const { draftUgcVideo } = await import("../app/lib/social/ugc-video-generator");

const markdown = readFileSync(resolve(ROOT, file), "utf8");
const slug      = basename(file, ".md");
const articleUrl = process.argv[3] ?? `https://thealignmenttimes.com/out-of-office/${slug}`;

const row = await draftUgcVideo({ slug, articleUrl, markdown });

console.log("Queued:", row.id);
console.log("Headline:", row.article_headline);
console.log("Status:", row.status);
console.log("\nNext: npx tsx scripts/ugc-review.mts", row.id);
