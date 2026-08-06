#!/usr/bin/env -S npx tsx
/**
 * ugc-list.mts
 * ────────────────────
 * Lists ugc_video_queue rows, most recent first, so you can see what's
 * drafted/generating/complete without querying Supabase directly.
 *
 * Usage (from project root):
 *   npx tsx scripts/ugc-list.mts
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

const { createAdminClient } = await import("../app/lib/supabase-server");

const supabase = createAdminClient();
const { data: rows, error } = await supabase
  .from("ugc_video_queue")
  .select("id, article_headline, status, compiled_video_url, created_at")
  .order("created_at", { ascending: false })
  .limit(30);

if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

if (!rows?.length) {
  console.log("No UGC videos queued yet. Draft one with: npx tsx scripts/ugc-draft.mts <path-to-out-of-office-md>");
  process.exit(0);
}

for (const row of rows) {
  console.log(`${row.id}  [${row.status}]  ${row.article_headline}`);
  if (row.compiled_video_url) console.log(`   -> ${row.compiled_video_url}`);
}
