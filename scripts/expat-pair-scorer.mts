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
 *   npx tsx scripts/expat-pair-scorer.mts --english   # only pairs with a professional-English
 *                                                      # population on at least one side — this
 *                                                      # site's actual target clientele (corporate
 *                                                      # expats who need to be fluent in English).
 *                                                      # Combine freely with --all/--limit.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");

const args    = process.argv.slice(2);
const showAll = args.includes("--all");
const englishOnly = args.includes("--english");
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

// Countries with a large professional-level-English-fluent population —
// this site's real target clientele (corporate expats who read/work in
// English), decided 2026-08/09-15 after two rejected narrower framings
// (restricting to Anglophone-only, then to corporate-hub destinations
// only — both too narrow). Final rule: it doesn't matter which side of
// the corridor is English-speaking, or whether it's the "hub"/destination
// side — just that professionals with strong English are plausibly on
// AT LEAST ONE side. Two groups:
//   - Native/official-language Anglophone: content in English is the
//     default for their own professional class.
//   - Large professional-English-fluent workforce even where English
//     isn't the majority first language (India, Philippines, Nigeria,
//     Kenya, Ghana, Pakistan, Malaysia, Singapore already covered under
//     Anglophone below).
const ENGLISH_FLUENT_COUNTRIES = new Set([
  "United States of America", "United Kingdom", "Canada", "Australia*", "Ireland",
  "New Zealand", "Singapore", "Philippines", "Nigeria", "Kenya", "Ghana",
  "South Africa*", "India", "Pakistan", "Malta",
]);

// Top 20 European economies by nominal GDP (2026-10-05 addition, user request:
// "add some european countries as well, all the top 20 ranked by gdp"). These
// are NOT English-first-language countries (that's ENGLISH_FLUENT_COUNTRIES
// above) — they're included because they're major corporate/professional
// markets in their own right, where this site's English-language content
// still has a real expat/corporate audience (multinational offices, EU
// freedom-of-movement professional migration, English as the de facto
// corporate lingua franca at large employers). UK and Ireland are already in
// the Anglophone set above, so not repeated here. Ranking is nominal GDP, a
// reasonable default but not the only valid basis (PPP would reorder a few)
// — revisit if the user wants a different year/measure.
const TOP_EUROPEAN_GDP_COUNTRIES = new Set([
  "Germany", "France*", "Italy", "Russian Federation", "Spain*", "Netherlands*",
  "Switzerland", "Poland", "Belgium", "Sweden", "Austria", "Norway*", "Denmark*",
  "Romania", "Czechia", "Finland*", "Portugal", "Greece",
]);

// Top 10 Latin American economies by nominal GDP, Mexico and south (2026-10-05
// addition, user request: "add a few latam countries... top 10 gdp from mexico
// and south of mexico"). Same reasoning as TOP_EUROPEAN_GDP_COUNTRIES: these
// aren't English-first-language countries, they're included as major regional
// economies/corporate markets in their own right. Ordering (Dominican
// Republic/Ecuador/Guatemala/Costa Rica) is close and shuffles year to year —
// treat as a reasonable snapshot, not a precise ranking.
const TOP_LATAM_GDP_COUNTRIES = new Set([
  "Brazil", "Mexico", "Argentina", "Colombia", "Chile", "Peru",
  "Dominican Republic", "Ecuador", "Guatemala", "Costa Rica",
]);

function isEnglishFluent(country: string): boolean {
  return ENGLISH_FLUENT_COUNTRIES.has(country);
}

function isMajorRegionalEconomy(country: string): boolean {
  return TOP_EUROPEAN_GDP_COUNTRIES.has(country) || TOP_LATAM_GDP_COUNTRIES.has(country);
}

// A major-regional-economy country alone does NOT make a pair relevant — e.g.
// Spain and Portugal are in TOP_EUROPEAN_GDP_COUNTRIES, but Bolivia->Spain and
// Angola->Portugal are Spanish/Portuguese-speaking diaspora migration with
// zero English relevance, not this site's corporate-expat audience. So a
// major-regional-economy match only counts if the OTHER side is itself a
// developed economy (high-income, per World Bank tier) or also a major
// regional economy — i.e. "two major economies trading professionals" reads
// as corporate-relevant (Germany<->Portugal, Brazil<->Mexico); "developing
// country -> big economy" reads as general diaspora/labor migration and is
// excluded, same reasoning as the existing Gulf-states caveat for
// UAE/Saudi/Kuwait/Qatar/Oman.
function isDevelopedEconomy(country: string): boolean {
  return incomeGroups[normalizeForIncomeLookup(country)] === "high";
}

// Combined target-clientele check — exported under the name "isEnglishFluent"
// call sites / the `--english` CLI flag for backward compatibility with
// scheduled-task instructions that already reference `--english`
// (out-of-office-weekly-batch, daily-work-culture-post).
function isTargetClientele(origin: string, dest: string): boolean {
  if (isEnglishFluent(origin) || isEnglishFluent(dest)) return true;
  const [regionSide, otherSide] = isMajorRegionalEconomy(origin) ? [origin, dest]
    : isMajorRegionalEconomy(dest) ? [dest, origin]
    : [null, null];
  if (!regionSide) return false;
  return isDevelopedEconomy(otherSide!) || isMajorRegionalEconomy(otherSide!);
}

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
  refugeeFlagged: boolean; expatHub: boolean; covered: boolean; englishFluent: boolean;
}

const covered = loadCoveredPairs();
const results: ScoredPair[] = corridors.map(([origin, dest, migrants]) => {
  const refugeeFlagged = REFUGEE_ORIGIN_COUNTRIES.has(origin);
  const expatHub = EXPAT_HUB_DESTINATIONS.has(dest);
  const destWeight = expatHub ? 1.4 : incomeWeight(dest);
  const refugeePenalty = refugeeFlagged ? 0.25 : 1.0;
  const score = Math.log10(migrants + 1) * refugeePenalty * destWeight;
  const pairKey = [toSlug(origin), toSlug(dest)].sort().join("|");
  const englishFluent = isTargetClientele(origin, dest);
  return { origin, dest, migrants, score, refugeeFlagged, expatHub, covered: covered.has(pairKey), englishFluent };
});

results.sort((a, b) => b.score - a.score);

let filtered = showAll ? results : results.filter((r) => !r.covered);
if (englishOnly) filtered = filtered.filter((r) => r.englishFluent);
const shown = filtered.slice(0, limit);

console.log(`Already-covered pairs found in content/: ${covered.size}`);
console.log(
  (showAll ? "Showing all pairs (including covered)" : "Showing top NEW (not yet covered) pairs")
  + (englishOnly ? ", filtered to professional-English-fluent audience only" : "")
  + ":\n"
);
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
