#!/usr/bin/env -S npx tsx
/**
 * ugc-review.mts
 * ────────────────────
 * Prints the drafted 5-clip script for a queued UGC video (no Hedra calls) —
 * read this before running ugc-approve.mts, which spends credits.
 *
 * Usage (from project root):
 *   npx tsx scripts/ugc-review.mts <queueId>
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
  console.error("Usage: npx tsx scripts/ugc-review.mts <queueId>");
  process.exit(1);
}

const { createAdminClient } = await import("../app/lib/supabase-server");

const supabase = createAdminClient();
const { data: row, error } = await supabase
  .from("ugc_video_queue")
  .select("*")
  .eq("id", queueId)
  .single();

if (error || !row) {
  console.error("Not found:", error?.message ?? queueId);
  process.exit(1);
}

console.log("Headline:", row.article_headline);
console.log("Article URL:", row.article_url);
console.log("Status:", row.status);
console.log();

for (const clip of row.clips) {
  console.log(`--- [${clip.label}] ---`);
  console.log(clip.script);
  console.log("Scene:", clip.scene);
  clip.captions?.forEach((c: string, i: number) => console.log(`  Caption ${i + 1}:`, c));
  console.log();
}

if (row.status === "pending_approval") {
  console.log(`Looks good? Run: npx tsx scripts/ugc-approve.mts ${row.id}`);
  console.log("(This submits 5 Hedra avatar-video generations — spends real credits.)");
} else {
  console.log(`Current status: ${row.status}`);
  if (row.status === "generating") {
    console.log(`Check progress: npx tsx scripts/ugc-status.mts ${row.id}`);
  }
  if (row.compiled_video_url) {
    console.log("Compiled video:", row.compiled_video_url);
  }
}
