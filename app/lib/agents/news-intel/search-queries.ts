/**
 * search-queries.ts
 *
 * Defines RSS query strings per pillar.
 * Each query is a Google News search string — no web_search API needed.
 *
 * Design: 2 queries per pillar × 5 pillars + 1 general = 11 RSS fetches/day.
 * All free. Claude scores the batch results with token-only calls.
 */

export interface PillarRSSConfig {
  /** Matches the pillar slug stored in news_feed.pillar */
  pillar: string;
  /** Human-readable description fed to Claude scoring prompt */
  label: string;
  /** Google News RSS search strings — 2 per pillar for breadth */
  queries: string[];
}

// Google News RSS supports a "when:" recency operator on the query string —
// when:1d restricts results to the last 24 hours. Without it, Google ranks
// by relevance, so an evergreen query like "labour union strike" can surface
// a two-week-old story every single day, and pillars end up rewriting the
// same news repeatedly. This is combined with a hard pubDate check in
// rss-fetcher.ts as defense-in-depth (the operator affects ranking, not a
// guarantee).
const RECENCY = "when:1d";

export const PILLAR_RSS_CONFIGS: PillarRSSConfig[] = [
  {
    pillar: "markets-floor",
    label: "Financial markets: stocks, indices, forex, commodities, earnings results, IPOs, crypto",
    queries: [
      `stock market earnings results IPO today ${RECENCY}`,
      `forex currency gold oil commodities crypto market ${RECENCY}`,
    ],
  },
  {
    pillar: "macro-mondays",
    label: "Macroeconomics: central bank decisions, inflation, GDP, unemployment, fiscal policy, sovereign debt",
    queries: [
      `central bank interest rate decision inflation CPI ${RECENCY}`,
      `GDP growth recession unemployment fiscal deficit sovereign debt ${RECENCY}`,
    ],
  },
  {
    pillar: "c-suite-circus",
    label: "Corporate: CEO appointments and departures, M&A deals, layoffs, quarterly earnings beats/misses, boardroom drama",
    queries: [
      `CEO fired resigned appointed merger acquisition corporate ${RECENCY}`,
      `layoffs restructuring earnings quarterly results corporate scandal ${RECENCY}`,
    ],
  },
  {
    pillar: "global-office",
    label: "Workplace: return-to-office mandates, remote work policy, labour unions, worker rights, productivity trends",
    queries: [
      `return to office remote work policy mandate ${RECENCY}`,
      `labour union strike workers rights workplace productivity ${RECENCY}`,
    ],
  },
  {
    pillar: "water-cooler",
    label: "Workplace culture: LinkedIn drama, corporate buzzwords, CEO social media controversies, absurd corporate behaviour",
    queries: [
      `LinkedIn viral corporate cringe CEO social media controversy ${RECENCY}`,
      `corporate buzzword wellness burnout hustle culture absurd ${RECENCY}`,
    ],
  },
];

/**
 * General breaking business news — stored with pillar: "general".
 * Available to all journalist agents via the context builder.
 */
export const GENERAL_BREAKING_QUERY =
  `major breaking business news corporate today ${RECENCY}`;
