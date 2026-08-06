#!/usr/bin/env -S npx tsx
/**
 * generate-compatibility-scores.mts
 * ────────────────────
 * Generates "The Alignment Times Compatibility Index" — an original,
 * satirical per-country-pair score, grounded in the site's own already-
 * published Global Office / Out of Office articles for that pair (not a
 * redistribution of Hofstede/World Values Survey/GLOBE — all three are
 * research/non-commercial-use only; ruled out before building this).
 *
 * For each unique country pair with ≥1 published article referencing both
 * countries (via Sanity's `countries[]` field — see
 * backfill-article-countries.mts for why that field is now populated),
 * this pulls the article text as grounding, asks Claude to produce a
 * structured satirical score, and upserts it into Supabase
 * `country_compatibility`.
 *
 * Usage (from project root):
 *   npx tsx scripts/generate-compatibility-scores.mts                # next 20 unscored pairs
 *   npx tsx scripts/generate-compatibility-scores.mts --limit 100
 *   npx tsx scripts/generate-compatibility-scores.mts --all          # every unscored pair
 *   npx tsx scripts/generate-compatibility-scores.mts --force        # regenerate scored pairs too
 *   npx tsx scripts/generate-compatibility-scores.mts --pair usa,japan
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

const args = process.argv.slice(2);
const force = args.includes("--force");
const all   = args.includes("--all");
const limitArg = args.indexOf("--limit");
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : 20;
const pairArg = args.indexOf("--pair");
const onlyPair = pairArg !== -1 ? args[pairArg + 1].split(",").map((s) => s.trim()) : null;

const { client } = await import("../app/lib/sanity");
const { createAdminClient } = await import("../app/lib/supabase-server");
const { callClaude, parseJSON, MODELS } = await import("../app/lib/claude");

if (!client) { console.error("Sanity client not configured"); process.exit(1); }

// ── Pull every article in both country-comparison pillars, with body text ──

interface SanityBlock { _type: string; children?: { text: string }[] }
interface SanityArticleRow {
  slug: string; title: string; pillar: string;
  countries: { slug: string; name: string }[];
  body: SanityBlock[];
}

const rows: SanityArticleRow[] = await client.fetch(
  `*[_type == "article" && pillar->slug.current in ["global-office", "out-of-office"] && count(countries) == 2]{
    "slug": slug.current, title, "pillar": pillar->slug.current,
    "countries": countries[]->{ "slug": slug.current, name },
    body
  }`
);

function blocksToText(blocks: SanityBlock[] | undefined, maxChars = 2500): string {
  if (!blocks) return "";
  const text = blocks
    .filter((b) => b._type === "block" && b.children)
    .map((b) => b.children!.map((c) => c.text).join(""))
    .join("\n");
  return text.slice(0, maxChars);
}

interface PairGroup {
  aSlug: string; aName: string; bSlug: string; bName: string;
  articles: { slug: string; pillar: string; title: string; text: string }[];
}

const pairs = new Map<string, PairGroup>();
for (const row of rows) {
  if (row.countries.length !== 2) continue;
  const [c1, c2] = row.countries;
  const [a, b] = c1.slug < c2.slug ? [c1, c2] : [c2, c1];
  const key = `${a.slug}|${b.slug}`;
  if (!pairs.has(key)) {
    pairs.set(key, { aSlug: a.slug, aName: a.name, bSlug: b.slug, bName: b.name, articles: [] });
  }
  pairs.get(key)!.articles.push({
    slug: row.slug, pillar: row.pillar, title: row.title, text: blocksToText(row.body),
  });
}

console.log(`Unique country pairs with published articles: ${pairs.size}`);

// ── Filter to what needs generating ─────────────────────────────────────

const supabase = createAdminClient();
const { data: existing } = await supabase.from("country_compatibility").select("country_a_slug, country_b_slug");
const existingKeys = new Set((existing ?? []).map((r) => `${r.country_a_slug}|${r.country_b_slug}`));

let todo = [...pairs.values()];
if (onlyPair) {
  const [x, y] = onlyPair.sort();
  todo = todo.filter((p) => p.aSlug === x && p.bSlug === y);
} else if (!force) {
  todo = todo.filter((p) => !existingKeys.has(`${p.aSlug}|${p.bSlug}`));
}
if (!all && !onlyPair) todo = todo.slice(0, limit);

console.log(`Generating scores for ${todo.length} pair(s)${force ? " (force regenerate)" : ""}...\n`);

// ── Generation ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are writing "The Alignment Times Compatibility Index" — a satirical but
well-informed country-compatibility score for The Alignment Times, a
publication whose voice is The Economist meets The Onion: dry, deadpan,
precise, never slapstick. This is an ORIGINAL editorial instrument, not a
scientific psychometric index — think of it like a restaurant critic's star
rating: opinionated, entertaining, but grounded in real reporting, not
invented from nothing.

You will be given excerpts from this publication's own already-published
articles comparing two countries' corporate/office and everyday culture.
Base your scoring on what those articles actually report — specific claims,
Do's/Don'ts, anecdotes — not generic stereotypes.

Score five fixed dimensions, each 0-100 (100 = highly compatible/aligned,
0 = wildly incompatible), each with a one-sentence dry, witty blurb:
1. Work-Life Balance
2. Hierarchy & Formality
3. Communication Style
4. Punctuality Culture
5. Social Bonding

Then an overallScore (0-100, roughly the average, adjusted for how
dramatically the two cultures clash overall) and a single "verdict" line —
one sharp, satirical sentence summarizing the pair, in the publication's
voice.

Respond with ONLY valid JSON, no markdown fences:
{
  "overallScore": number,
  "verdict": string,
  "dimensions": [
    { "label": string, "score": number, "blurb": string }
  ]
}`;

let done = 0, failed = 0;
for (const pair of todo) {
  const grounding = pair.articles
    .map((a) => `[${a.pillar}] ${a.title}\n${a.text}`)
    .join("\n\n---\n\n");

  const userPrompt = `Country A: ${pair.aName}
Country B: ${pair.bName}

Published articles about this pair (${pair.articles.length}):

${grounding}`;

  try {
    const response = await callClaude(
      SYSTEM_PROMPT, userPrompt, 900, "compatibility-score", MODELS.default
    );
    const result = parseJSON<{
      overallScore: number; verdict: string;
      dimensions: { label: string; score: number; blurb: string }[];
    }>(response.content);

    const { error } = await supabase.from("country_compatibility").upsert({
      country_a_slug: pair.aSlug, country_a_name: pair.aName,
      country_b_slug: pair.bSlug, country_b_name: pair.bName,
      overall_score:  result.overallScore,
      verdict:        result.verdict,
      dimensions:     result.dimensions,
      source_articles: pair.articles.map((a) => ({ slug: a.slug, section: a.pillar, title: a.title })),
      generated_at:   new Date().toISOString(),
    }, { onConflict: "country_a_slug,country_b_slug" });

    if (error) throw new Error(error.message);
    console.log(`✓ ${pair.aName} <-> ${pair.bName}: ${result.overallScore} — "${result.verdict}"`);
    done++;
  } catch (err) {
    console.error(`✗ ${pair.aName} <-> ${pair.bName}:`, (err as Error).message);
    failed++;
  }
}

console.log(`\nDone: ${done}  Failed: ${failed}  Remaining unscored: ${pairs.size - existingKeys.size - done}`);
