#!/usr/bin/env node
/**
 * publish-global-office.mjs
 * ─────────────────────────
 * Manual one-shot publisher for Global Office .md articles (local dev use).
 * Production publishing is handled by the cron route:
 *   app/api/cron/publish-articles/route.ts  (runs daily at 09:00 UTC)
 *
 * WARNING: The markdown parsing helpers (parseFrontmatter, markdownToBlocks,
 * parseInline, slugify) are duplicated from route.ts. If you fix a bug in
 * one, apply the same fix in the other.
 *
 * Usage (from project root):
 *   node scripts/publish-global-office.mjs            → publish 2 articles
 *   node scripts/publish-global-office.mjs --dry-run  → preview only
 *   node scripts/publish-global-office.mjs --count 1  → publish N articles
 */

import { createClient } from "@sanity/client";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const TRACKING  = resolve(__dirname, ".published-global-office.json");
const DOTENV    = resolve(ROOT, ".env.local");

// ── Load .env.local ──────────────────────────────────────────────────────────

function loadEnv(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv(DOTENV);

// ── Config ───────────────────────────────────────────────────────────────────

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "e8dwtkci";
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET    ?? "production";
const TOKEN      = process.env.SANITY_API_TOKEN;
const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealignmenttimes.com";
const REVALIDATE = process.env.REVALIDATE_SECRET ?? "";

const PILLAR_ID   = "global-office";
const PILLAR_NAME = "The Global Office";
const AUTHOR_ID   = "author-priya-mehta";
const AUTHOR_NAME = "Priya Mehta";

// ── Args ─────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const COUNT   = (() => {
  const i = args.indexOf("--count");
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : 2;
})();

// ── Sanity client ─────────────────────────────────────────────────────────────

const writeClient = createClient({
  projectId: PROJECT_ID,
  dataset:   DATASET,
  apiVersion: "2024-01-01",
  useCdn:    false,
  token:     TOKEN,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

let _keyCounter = 0;
function key() { return `k${++_keyCounter}`; }

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96);
}

/** Parse inline markdown bold/italic into Sanity span children */
function parseInline(text) {
  const spans = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|([^*]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) spans.push({ _type: "span", _key: key(), text: m[1], marks: ["strong"] });
    else if (m[2]) spans.push({ _type: "span", _key: key(), text: m[2], marks: ["em"] });
    else if (m[3]) spans.push({ _type: "span", _key: key(), text: m[3], marks: [] });
  }
  return spans.length ? spans : [{ _type: "span", _key: key(), text, marks: [] }];
}

/** Convert markdown body to Sanity portable text blocks */
function markdownToBlocks(body) {
  const blocks = [];
  const paras  = body.split(/\n{2,}/);

  for (let para of paras) {
    para = para.trim();
    if (!para || /^!\[/.test(para)) continue;

    // ── Headings ──────────────────────────────────────────────────────────────
    const h4 = para.match(/^####\s+(.+)/);
    const h3 = para.match(/^###\s+(.+)/);
    const h2 = para.match(/^##\s+(.+)/);
    if (h4) { blocks.push({ _type: "block", _key: key(), style: "h3", markDefs: [], children: parseInline(h4[1]) }); continue; }
    if (h3) { blocks.push({ _type: "block", _key: key(), style: "h3", markDefs: [], children: parseInline(h3[1]) }); continue; }
    if (h2) { blocks.push({ _type: "block", _key: key(), style: "h2", markDefs: [], children: parseInline(h2[1]) }); continue; }

    // ── Markdown table ────────────────────────────────────────────────────────
    // Detected when multiple lines contain | characters
    const lines = para.split("\n");
    const tableLines = lines.filter(l => l.includes("|"));
    if (tableLines.length > 1) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Skip separator rows like |---|---|
        if (/^\|[-|\s:]+\|$/.test(trimmed)) continue;
        // Extract cells, strip empty first/last from leading/trailing pipes
        const cells = trimmed.split("|").map(c => c.trim()).filter(Boolean);
        if (cells.length === 0) continue;
        const text = cells.join("  |  ");
        if (text.trim()) {
          blocks.push({ _type: "block", _key: key(), style: "normal", markDefs: [], children: parseInline(text) });
        }
      }
      continue;
    }

    // ── Normal paragraph ──────────────────────────────────────────────────────
    const merged = para.split("\n").map(l => l.trim()).filter(Boolean).join(" ");
    if (!merged || /^!\[/.test(merged)) continue;
    blocks.push({ _type: "block", _key: key(), style: "normal", markDefs: [], children: parseInline(merged) });
  }
  return blocks;
}

/** Parse YAML-ish frontmatter (handles simple key: value and nested maps) */
function parseFrontmatter(raw) {
  const fm = {};
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Nested block (e.g. images:)
    const nested = line.match(/^(\w+):\s*$/);
    if (nested) {
      const block = {};
      i++;
      while (i < lines.length && /^\s{2}/.test(lines[i])) {
        const kv = lines[i].trim().match(/^(\w+):\s*(.*)/);
        if (kv) block[kv[1]] = kv[2].trim();
        i++;
      }
      fm[nested[1]] = block;
      continue;
    }
    const kv = line.match(/^(\w[\w_]*):\s*(.*)/);
    if (kv) fm[kv[1]] = kv[2].trim();
    i++;
  }
  return fm;
}

/** Parse one .md file into a structured article object */
function parseArticle(filePath) {
  const text  = readFileSync(filePath, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) { console.warn(`  ⚠ No frontmatter: ${filePath}`); return null; }

  const fm     = parseFrontmatter(match[1]);
  const bodyMd = match[2].trim();

  // Title from first H1, fallback to filename
  const titleMatch = bodyMd.match(/^#\s+(.+)$/m);
  const title      = titleMatch ? titleMatch[1].trim() : filePath.split("/").pop().replace(/-/g," ");

  // Excerpt: first non-heading paragraph, stripped of markdown
  const bodyNoTitle = bodyMd.replace(/^#\s+.+\n*/m, "").trim();
  const firstBlock  = bodyNoTitle.split(/\n{2,}/)[0] || "";
  const excerpt     = firstBlock
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/^#+\s+/, "")
    .trim()
    .slice(0, 300);

  // Image URLs
  const images  = fm.images || {};
  const heroUrl = images.hero || "";
  const ogUrl   = images.body || heroUrl;

  // Countries
  const countriesRaw = fm.countries || "";
  const countries    = typeof countriesRaw === "string"
    ? countriesRaw.split(",").map(c => c.trim()).filter(Boolean)
    : [];

  // Published date at 8am UTC
  const dateStr = fm.date || new Date().toISOString().split("T")[0];
  const pubDt   = new Date(`${dateStr}T08:00:00Z`).toISOString();

  // Read time
  const wordCount = parseInt(fm.word_count) || bodyMd.split(/\s+/).length;
  const readTime  = Math.max(1, Math.round(wordCount / 200));

  // Slug from title
  const slug = slugify(title);

  // Portable text
  const blocks = markdownToBlocks(bodyNoTitle);

  // SEO
  const subject = fm.subject || "";
  const cStr    = countries.slice(0, 2).join(" vs ");
  const seoDesc = `${cStr}: ${subject}. Analysis by Priya Mehta for The Alignment Times.`.slice(0, 160);

  return { title, slug, excerpt, subject, countries, heroUrl, ogUrl, pubDt, readTime, blocks, seoDesc, wordCount };
}

// ── Sanity mutations ──────────────────────────────────────────────────────────

async function ensurePillar() {
  await writeClient.createIfNotExists({
    _id: PILLAR_ID, _type: "pillar",
    name: PILLAR_NAME,
    slug: { _type: "slug", current: PILLAR_ID },
  });
}

async function ensureAuthor() {
  await writeClient.createIfNotExists({
    _id: AUTHOR_ID, _type: "author",
    name: AUTHOR_NAME,
    slug: { _type: "slug", current: "priya-mehta" },
    bio:  "Staff writer for The Alignment Times covering global work and life culture.",
  });
}

async function ensureCountries(countries) {
  for (const c of countries) {
    const cid = "country-" + slugify(c);
    await writeClient.createIfNotExists({
      _id: cid, _type: "country",
      name: c,
      slug: { _type: "slug", current: cid.replace("country-", "") },
    });
  }
}

async function publishArticle(article) {
  const docId = `article-${article.slug}`;

  const countryRefs = article.countries.map(c => ({
    _type: "reference", _ref: "country-" + slugify(c), _key: key(),
  }));

  const doc = {
    _id:              docId,
    _type:            "article",
    title:            article.title,
    slug:             { _type: "slug", current: article.slug },
    excerpt:          article.excerpt,
    body:             article.blocks,
    pillar:           { _type: "reference", _ref: PILLAR_ID },
    author:           { _type: "reference", _ref: AUTHOR_ID },
    countries:        countryRefs,
    publishedAt:      article.pubDt,
    readTime:         article.readTime,
    featured:         false,
    aiGenerated:      true,
    agentName:        "Priya Mehta",
    ogImage:          article.ogUrl || article.heroUrl,
    imageGeneratedWith: "pexels",
    seoDescription:   article.seoDesc,
  };

  await writeClient.createOrReplace(doc);

  // Trigger ISR revalidation (non-fatal)
  try {
    await fetch(`${SITE_URL}/api/revalidate?secret=${REVALIDATE}&path=/global-office`, { method: "POST" });
  } catch {}

  return `${SITE_URL}/global-office/${article.slug}`;
}

// ── Tracking ──────────────────────────────────────────────────────────────────

function loadTracking() {
  return existsSync(TRACKING) ? new Set(JSON.parse(readFileSync(TRACKING, "utf8"))) : new Set();
}

function saveTracking(set) {
  writeFileSync(TRACKING, JSON.stringify([...set].sort(), null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error("❌ SANITY_API_TOKEN not found in .env.local");
    process.exit(1);
  }

  const allMd = readdirSync(ROOT)
    .filter(f => f.endsWith(".md") && f !== "SKILL.md")
    .sort();

  const published  = loadTracking();
  const candidates = allMd.filter(f => !published.has(f));

  if (!candidates.length) {
    console.log("✅ All articles already published — nothing to do.");
    return;
  }

  const toPublish = candidates.slice(0, COUNT);
  console.log(`📋 ${candidates.length} unpublished articles. Publishing ${toPublish.length}.\n`);

  if (!DRY_RUN) {
    console.log("🔧 Ensuring pillar and author exist...");
    await ensurePillar();
    await ensureAuthor();
  }

  const newlyPublished = [];

  for (const filename of toPublish) {
    console.log(`📄 ${filename}`);
    const article = parseArticle(resolve(ROOT, filename));
    if (!article) { console.log("  ⚠ Skipped.\n"); continue; }

    if (DRY_RUN) {
      console.log(`  [dry-run] article-${article.slug}`);
      console.log(`  Title:  ${article.title}`);
      console.log(`  Blocks: ${article.blocks.length}`);
      console.log(`  URL:    ${SITE_URL}/global-office/${article.slug}\n`);
      continue;
    }

    await ensureCountries(article.countries);
    const url = await publishArticle(article);
    published.add(filename);
    newlyPublished.push({ filename, title: article.title, url });
    console.log(`  ✓ ${article.title}`);
    console.log(`    → ${url}\n`);
  }

  if (!DRY_RUN && newlyPublished.length) {
    saveTracking(published);
    console.log(`✅ ${newlyPublished.length} article(s) published.`);
  } else if (DRY_RUN) {
    console.log(`✅ Dry run — ${toPublish.length} would be published.`);
  }

  const remaining = candidates.length - toPublish.length;
  if (remaining > 0) console.log(`📬 ${remaining} articles remain in queue.`);
}

main().catch(err => { console.error("❌", err.message); process.exit(1); });
