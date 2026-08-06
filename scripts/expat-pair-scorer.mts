#!/usr/bin/env -S npx tsx
/**
 * expat-pair-scorer.mts
 * ────────────────────
 * Ranks country pairs by how likely they are to have a real EXPAT/
 * professional audience — as opposed to raw migration volume, which is
 * dominated by refugee flows (Afghanistan→Iran, Syria→Türkiye,
 * Venezuela→Colombia) and low-wage labor corridors (Bangladesh→Saudi
 * Arabia) that don't match this site's "corporate/office culture" angle.
 *
 * Data sources (both free for any use, unlike Hofstede/WVS — see
 * data/migration/README for why those were ruled out):
 *   - UN DESA International Migrant Stock 2024, bilateral matrix
 *     (data/migration/un-migrant-corridors-2024.json, trimmed to pairs
 *     ≥5,000 people). Source: https://www.un.org/development/desa/pd/content/international-migrant-stock
 *   - World Bank income classification, FY2026, via Our World in Data
 *     (CC BY). (data/migration/world-bank-income-groups-2025.json)
 *
 * Scoring, per pair:
 *   score = log10(migrants) × refugeeOriginPenalty × destinationDesirability
 *
 * - refugeeOriginPenalty: 0.25× if the origin country is a major current
 *   forced-displacement origin (UNHCR's largest situations) — these pairs
 *   are real people, but not the "chose this for work/lifestyle" audience
 *   this content targets. Not zeroed out entirely because some genuine
 *   professional emigration still happens even from these countries.
 * - destinationDesirability: 1.4× for a recognized expat/digital-nomad hub
 *   (InterNations' 2026 top destinations + a few other obvious ones),
 *   otherwise scaled by the destination's World Bank income tier
 *   (high=1.2, upper-middle=1.0, lower-middle=0.8, low=0.6). Deliberately
 *   NOT weighting by origin income tier — India is "lower-middle-income"
 *   in aggregate but is one of the biggest sources of genuine skilled/
 *   professional emigration in the world (Canada, UK, Australia, UAE),
 *   so penalizing by origin income would wrongly suppress exactly the
 *   pairs this site should be covering.
 *
 * Usage (from project root):
 *   npx tsx scripts/expat-pair-scorer.mts            # top 40 new-pair suggestions
 *   npx tsx scripts/expat-pair-scorer.mts --all       # don't filter out already-covered pairs
 *   npx tsx scripts/expat-pair-scorer.mts --limit 100
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");

const args    = process.argv.slice(2);
const showAll = args.includes("--all");
const limitArg = args.indexOf("--limit");
const limit   = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : 40;

// ── Load data ────────────────────────────────────────────────────────────

type Corridor = [origin: string, dest: string, migrants: number];
const corridors: Corridor[] = JSON.parse(
  readFileSync(resolve(ROOT, "data/migration/un-migrant-corridors-2024.json"), "utf8")
);
const incomeGroups: Record<string, string> = JSON.parse(
  readFileSync(resolve(ROOT, "data/migration/world-bank-income-groups-2025.json"), "utf8")
);

// Major current forced-displacement origins (UNHCR's largest situations,
// manually curated — stable enough year to year that a live join isn't
// worth the added complexity/fragility of matching UNHCR's own country
// naming against the UN DESA matrix).
const REFUGEE_ORIGIN_COUNTRIES = new Set([
  "Afghanistan", "Syrian Arab Republic", "Ukraine*", "Venezuela (Bolivarian Republic of)",
  "South Sudan", "Sudan", "Myanmar", "Somalia", "Democratic Republic of the Congo",
  "Yemen", "State of Palestine", "Central African Republic", "Eritrea", "Ethiopia",
]);

// InterNations Expat Insider 2026 top-10 destinations + other well-known
// expat/digital-nomad hubs not already in that list.
const EXPAT_HUB_DESTINATIONS = new Set([
  "Panama", "Mexico", "Thailand", "United Arab Emirates", "Brazil", "Spain*",
  "Singapore", "Portugal", "Malaysia", "Luxembourg",
  "Indonesia", "Costa Rica", "Viet Nam", "Colombia", "China, Taiwan Province of China",
]);

function incomeWeight(country: string): number {
  const tier = incomeGroups[normalizeForIncomeLookup(country)];
  if (tier === "high") return 1.2;
  if (tier === "upper_middle") return 1.0;
  if (tier === "lower_middle") return 0.8;
  if (tier === "low") return 0.6;
  return 0.9; // unknown — neutral-ish
}

// UN DESA names -> Our World in Data / World Bank names differ for a
// handful of countries; strip the UN's asterisk/footnote markers and
// parenthetical suffixes, then apply explicit aliases for the rest.
const INCOME_NAME_ALIASES: Record<string, string> = {
  "United States of America": "United States",
  "United Kingdom": "United Kingdom",
  "Republic of Korea": "South Korea",
  "Iran (Islamic Republic of)": "Iran",
  "Russian Federation": "Russia",
  "Viet Nam": "Vietnam",
  "Türkiye": "Turkey",
  "Venezuela (Bolivarian Republic of)": "Venezuela",
  "Bolivia (Plurinational State of)": "Bolivia",
  "United Republic of Tanzania": "Tanzania",
  "Syrian Arab Republic": "Syria",
  "Lao People's Democratic Republic": "Laos",
  "Republic of Moldova": "Moldova",
  "Democratic Republic of the Congo": "Democratic Republic of Congo",
  "Congo": "Congo",
  "Côte d'Ivoire": "Cote d'Ivoire",
  "State of Palestine": "Palestine",
  "Brunei Darussalam": "Brunei",
  "China, Hong Kong SAR": "Hong Kong",
  "China, Taiwan Province of China": "Taiwan",
};

function normalizeForIncomeLookup(country: string): string {
  const stripped = country.replace(/\*$/, "").trim();
  return INCOME_NAME_ALIASES[stripped] ?? stripped;
}

// Site content uses lowercase-hyphenated slugs (e.g. "south-korea",
// "usa", "uae") — normalize UN names down to the same convention so we
// can cross-check against what's already published.
const SLUG_ALIASES: Record<string, string> = {
  "United States of America": "usa",
  "United Kingdom": "uk",
  "Republic of Korea": "south-korea",
  "Russian Federation": "russia",
  "Viet Nam": "vietnam",
  "Türkiye": "turkey",
  "Venezuela (Bolivarian Republic of)": "venezuela",
  "United Arab Emirates": "uae",
  "United Republic of Tanzania": "tanzania",
  "Côte d'Ivoire": "ivory-coast",
  "Bolivia (Plurinational State of)": "bolivia",
  "Lao People's Democratic Republic": "laos",
  "Brunei Darussalam": "brunei",
  "Cabo Verde": "cape-verde",
  "China, Taiwan Province of China": "taiwan",
  "Czechia": "czech-republic",
  "Trinidad and Tobago": "trinidad-and-tobago",
  "Papua New Guinea": "papua-new-guinea",
  "Bosnia and Herzegovina": "bosnia-and-herzegovina",
  "North Macedonia": "north-macedonia",
  "New Zealand": "new-zealand",
  "South Africa": "south-africa",
  "Saudi Arabia": "saudi-arabia",
  "Costa Rica": "costa-rica",
  "Dominican Republic": "dominican-republic",
};

function toSlug(country: string): string {
  const stripped = country.replace(/\*$/, "").trim();
  if (SLUG_ALIASES[stripped]) return SLUG_ALIASES[stripped];
  return stripped.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ── Already-covered pairs (both pillars) ────────────────────────────────

function loadCoveredPairs(): Set<string> {
  const covered = new Set<string>();
  for (const dir of ["content/global-office", "content/out-of-office"]) {
    const full = resolve(ROOT, dir);
    if (!existsSync(full)) continue;
    for (const file of readdirSync(full)) {
      const m = file.match(/^\d{4}-\d{2}-\d{2}_\d+_([a-z0-9-]+)-vs-([a-z0-9-]+)_/);
      if (!m) continue;
      const [, a, b] = m;
      covered.add([a, b].sort().join("|"));
    }
  }
  return covered;
}

// ── Score ────────────────────────────────────────────────────────────────

interface ScoredPair {
  origin: string; dest: string; migrants: number; score: number;
  refugeeFlagged: boolean; expatHub: boolean; covered: boolean;
}

const covered = loadCoveredPairs();
const results: ScoredPair[] = corridors.map(([origin, dest, migrants]) => {
  const refugeeFlagged = REFUGEE_ORIGIN_COUNTRIES.has(origin);
  const expatHub = EXPAT_HUB_DESTINATIONS.has(dest);
  const destWeight = expatHub ? 1.4 : incomeWeight(dest);
  const refugeePenalty = refugeeFlagged ? 0.25 : 1.0;
  const score = Math.log10(migrants + 1) * refugeePenalty * destWeight;
  const pairKey = [toSlug(origin), toSlug(dest)].sort().join("|");
  return { origin, dest, migrants, score, refugeeFlagged, expatHub, covered: covered.has(pairKey) };
});

results.sort((a, b) => b.score - a.score);

const shown = (showAll ? results : results.filter((r) => !r.covered)).slice(0, limit);

console.log(`Already-covered pairs found in content/: ${covered.size}`);
console.log(showAll ? "Showing all pairs (including covered):\n" : "Showing top NEW (not yet covered) pairs:\n");
console.log(
  "score".padEnd(7), "migrants".padEnd(12), "flags".padEnd(8), "origin -> destination"
);
for (const r of shown) {
  const flags = [r.refugeeFlagged ? "refugee" : "", r.expatHub ? "hub" : ""].filter(Boolean).join(",");
  console.log(
    r.score.toFixed(2).padEnd(7),
    r.migrants.toLocaleString().padEnd(12),
    flags.padEnd(8),
    `${r.origin} -> ${r.dest}${r.covered ? "  [covered]" : ""}`
  );
}
