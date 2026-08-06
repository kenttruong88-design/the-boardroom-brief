#!/usr/bin/env -S npx tsx
/**
 * backfill-article-countries.mts
 * ────────────────────
 * Fixes historical data: `publish-out-of-office`'s Sanity write never set
 * `countries` at all (bug — the `countries` array only existed on a
 * throwaway object used for image generation, never on the actual document;
 * fixed in the route itself as of this same change). `publish-global-office`
 * does set it correctly, but only articles published after that field was
 * added have it — everything before is missing it too.
 *
 * Net effect found live: 1129 published articles, only 16 had `countries`
 * populated. This script re-derives the country pair from each article's
 * local content/*.md source (same title -> slug -> docId logic the publish
 * scripts use) and patches the matching Sanity document.
 *
 * Usage (from project root):
 *   npx tsx scripts/backfill-article-countries.mts --dry-run   # preview only
 *   npx tsx scripts/backfill-article-countries.mts             # apply patches
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const dryRun    = process.argv.includes("--dry-run");

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

const { createClient } = await import("@sanity/client");
const client = createClient({
  projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "e8dwtkci",
  dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET    ?? "production",
  apiVersion: "2024-01-01",
  useCdn:     false,
  token:      process.env.SANITY_API_TOKEN,
});

// ── Same slugify + frontmatter + title-extraction logic as the publish
// scripts (duplicated rather than imported — those live in a non-exporting
// route.ts / a standalone .mjs, and this is small enough not to be worth
// wiring up a shared module for). ──────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96);
}

function parseFrontmatter(raw: string): Record<string, string> {
  const fm: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const kv = line.match(/^(\w[\w_]*):\s*(.*)/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function extractTitle(bodyMd: string, filePath: string): string {
  const h1 = bodyMd.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const lines = bodyMd.split("\n");
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  const firstLine = firstIdx >= 0 ? lines[firstIdx].trim() : "";
  const bold = firstLine.match(/^\*\*(.+?)\*\*$/);
  if (bold) return bold[1].trim();
  return filePath.split(/[/\\]/).pop()!.replace(/\.md$/i, "").replace(/-/g, " ");
}

interface LocalArticle { docId: string; title: string; countries: string[]; file: string }

function scanPillar(dir: string, docIdPrefix: string): LocalArticle[] {
  const full = resolve(ROOT, dir);
  if (!existsSync(full)) return [];
  const out: LocalArticle[] = [];
  for (const file of readdirSync(full)) {
    if (!file.endsWith(".md")) continue;
    const filePath = join(full, file);
    const text  = readFileSync(filePath, "utf8");
    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) continue;
    const fm = parseFrontmatter(match[1]);
    const bodyMd = match[2].trim();
    const title = extractTitle(bodyMd, filePath);
    const slug  = slugify(title);
    const countries = (fm.countries ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (countries.length === 0) continue;
    out.push({ docId: `${docIdPrefix}${slug}`, title, countries, file });
  }
  return out;
}

const localArticles = [
  ...scanPillar("content/global-office", "article-"),
  ...scanPillar("content/out-of-office", "article-ooo-"),
];
const byDocId = new Map(localArticles.map((a) => [a.docId, a]));
console.log(`Local articles with a country pair in frontmatter: ${localArticles.length}`);

// ── Find Sanity docs missing countries ──────────────────────────────────

interface SanityDoc { _id: string; title: string }
const missing: SanityDoc[] = await client.fetch(
  `*[_type == "article" && (!defined(countries) || count(countries) == 0)]{ _id, title }`
);
console.log(`Sanity articles missing countries: ${missing.length}`);

let matched = 0, patched = 0, unmatched = 0;
const countryDocsEnsured = new Set<string>();
let _k = 0;
const key = () => `bf${++_k}`;

for (const doc of missing) {
  const local = byDocId.get(doc._id);
  if (!local) { unmatched++; continue; }
  matched++;

  if (dryRun) {
    console.log(`[dry-run] ${doc._id} <- ${local.countries.join(", ")}`);
    continue;
  }

  for (const c of local.countries) {
    const cid = "country-" + slugify(c);
    if (countryDocsEnsured.has(cid)) continue;
    await client.createIfNotExists({
      _id: cid, _type: "country", name: c,
      slug: { _type: "slug", current: cid.replace("country-", "") },
    });
    countryDocsEnsured.add(cid);
  }

  const countryRefs = local.countries.map((c) => ({
    _type: "reference", _ref: "country-" + slugify(c), _key: key(),
  }));
  await client.patch(doc._id).set({ countries: countryRefs }).commit();
  patched++;
  if (patched % 50 === 0) console.log(`  ...${patched} patched`);
}

console.log(`\nMatched to a local file: ${matched}`);
console.log(`Unmatched (no local source found, left as-is): ${unmatched}`);
if (!dryRun) console.log(`Patched: ${patched}`);
if (dryRun) console.log("\nDry run only — rerun without --dry-run to apply.");
