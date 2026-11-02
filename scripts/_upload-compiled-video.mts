#!/usr/bin/env -S npx tsx
/**
 * _upload-compiled-video.mts <queueId>
 * One-off: re-uploads a row's dynamically-spliced compiled_video_url as a
 * real, standalone Cloudinary asset (boardroom-brief/ugc/compiled/<slug>)
 * so it shows up in the Media Library UI instead of only existing as a
 * long transformation URL.
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

const { v2: cloudinary } = await import("cloudinary");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const { createAdminClient } = await import("../app/lib/supabase-server");

const id = process.argv[2];
if (!id) {
  console.error("Usage: npx tsx scripts/_upload-compiled-video.mts <queueId>");
  process.exit(1);
}

const supabase = createAdminClient();
const { data: row, error } = await supabase
  .from("ugc_video_queue")
  .select("id, article_slug, compiled_video_url")
  .eq("id", id)
  .single();

if (error || !row?.compiled_video_url) {
  console.error(error ?? "No compiled_video_url on this row");
  process.exit(1);
}

const publicId = `ugc-${row.article_slug}-COMPILED`;
const upload = await cloudinary.uploader.upload(row.compiled_video_url, {
  resource_type: "video",
  folder:        "boardroom-brief/ugc/compiled",
  public_id:      publicId,
  overwrite:      true,
  // The spliced URL renders as fragmented H.264 tagged level 6.2, which
  // phones refuse to play (2026-11-02). Re-encode on the way in to a plain
  // main-profile level 4.0 MP4.
  transformation: [{ video_codec: "h264:main:4.0", audio_codec: "aac" }],
});

console.log("Uploaded:", upload.public_id);
console.log("secure_url:", upload.secure_url);
