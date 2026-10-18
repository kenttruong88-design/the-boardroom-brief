#!/usr/bin/env -S npx tsx
/**
 * One-off repair (2026-10-18): Global Office articles published with a
 * filename as their headline ("2026 07 23_03_canada vs singapore_...")
 * because the title parser didn't recognise H2 / [HEADLINE] / bare-line
 * titles. Re-derives the real title with the fixed parser and patches
 * title, heroImageAlt, seoDescription and excerpt, and drops the headline's
 * duplicate first body block. Slugs/ids are left alone so URLs don't change.
 *
 * Usage: npx tsx scripts/_fix-filename-titles.mts [--apply]
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@sanity/client";
import { extractTitle } from "../app/lib/content/article-title";

for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const eq = line.indexOf("=");
  if (eq > 0 && !line.trim().startsWith("#")) process.env[line.slice(0, eq).trim()] ??= line.slice(eq + 1).trim().replace(/^"|"$/g, "");
}
const APPLY = process.argv.includes("--apply");
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!, dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-01-01", useCdn: false, token: process.env.SANITY_API_TOKEN,
});

// Same excerpt logic as the publish crons.
function extractExcerpt(noTitle: string): string {
  for (const para of noTitle.split(/\n{2,}/)) {
    const stripped = para.trim().replace(/^\*\*(.+)\*\*$/, "$1").replace(/^\*(.+)\*$/, "$1").trim();
    if (!stripped) continue;
    if (/^-{3,}$/.test(stripped)) continue;
    if (/^[\u{1F1E6}-\u{1F1FF}]/u.test(stripped)) continue;
    if (/^By\s+/i.test(stripped)) continue;
    return stripped.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1")
      .replace(/!\[.*?\]\(.*?\)/g, "").replace(/^#+\s+/, "").trim().slice(0, 300);
  }
  return "";
}
const norm = (s: string) => s.replace(/\[HEADLINE\]/gi, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();

type Doc = { _id: string; title: string; slug: string; body: { _key: string; style?: string; children?: { text: string }[] }[] };
const docs: Doc[] = await client.fetch(
  `*[_type == "article" && pillar._ref in ["global-office", "out-of-office"] && title match "2026*" && !(_id in path("drafts.**"))]{ _id, title, "slug": slug.current, "pillar": pillar._ref, body }`
);
console.log(`${docs.length} articles with a filename headline\n`);

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.thealignmenttimes.com";
for (const doc of docs) {
  const pillar = (doc as unknown as { pillar: string }).pillar;
  // "2026 07 23_03_canada vs singapore_fashion culture" -> 2026-07-23_03_canada-vs-singapore_fashion-culture.md
  const filename = doc.title.replace(/^(\d{4}) (\d{2}) (\d{2})_/, "$1-$2-$3_").replace(/ /g, "-") + ".md";
  const path = `content/${pillar}/${filename}`;
  if (!existsSync(path)) { console.log(`!! no source file for ${doc._id} (${path})`); continue; }

  const m = readFileSync(path, "utf8").replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)!;
  const { title, noTitle } = extractTitle(m[2].trim(), path);
  if (/^\d{4}/.test(title)) { console.log(`!! still no headline for ${filename}`); continue; }
  const excerpt = extractExcerpt(noTitle);
  const author = pillar === "global-office" ? "Priya Mehta" : "Suki Nakamura";

  const first = doc.body?.[0];
  const firstText = first?.children?.map((c) => c.text).join("") ?? "";
  const dropFirst = !!first && norm(firstText) === norm(title);

  console.log(`${doc.slug}\n  -> ${title}\n  drop first block: ${dropFirst ? "yes" : `NO (${first?.style}: "${firstText.slice(0, 60)}")`}`);
  if (!APPLY) continue;

  let patch = client.patch(doc._id).set({
    title,
    heroImageAlt: title,
    seoDescription: `${title}. By ${author} for The Boardroom Brief.`.slice(0, 160),
    excerpt,
  });
  if (dropFirst) patch = patch.unset([`body[_key=="${first!._key}"]`]);
  await patch.commit();
  const res = await fetch(`${siteUrl}/api/revalidate?secret=${process.env.SANITY_WEBHOOK_SECRET ?? ""}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ _type: "article", slug: { current: doc.slug }, pillarSlug: pillar }),
  });
  console.log(`  patched, revalidate ${res.status}`);
}
