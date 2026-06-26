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

export const PILLAR_RSS_CONFIGS: PillarRSSConfig[] = [
  {
    pillar: "markets-floor",
    label: "Financial markets: stocks, indices, forex, commodities, earnings results, IPOs, crypto",
    queries: [
      "stock market earnings results IPO today 2026",
      "forex currency gold oil commodities crypto market 2026",
    ],
  },
  {
    pillar: "macro-mondays",
    label: "Macroeconomics: central bank decisions, inflation, GDP, unemployment, fiscal policy, sovereign debt",
    queries: [
      "central bank interest rate decision inflation CPI 2026",
      "GDP growth recession unemployment fiscal deficit sovereign debt 2026",
    ],
  },
  {
    pillar: "c-suite-circus",
    label: "Corporate: CEO appointments and departures, M&A deals, layoffs, quarterly earnings beats/misses, boardroom drama",
    queries: [
      "CEO fired resigned appointed merger acquisition corporate 2026",
      "layoffs restructuring earnings quarterly results corporate scandal 2026",
    ],
  },
  {
    pillar: "global-office",
    label: "Workplace: return-to-office mandates, remote work policy, labour unions, worker rights, productivity trends",
    queries: [
      "return to office remote work policy mandate 2026",
      "labour union strike workers rights workplace productivity 2026",
    ],
  },
  {
    pillar: "water-cooler",
    label: "Workplace culture: LinkedIn drama, corporate buzzwords, CEO social media controversies, absurd corporate behaviour",
    queries: [
      "LinkedIn viral corporate cringe CEO social media controversy 2026",
      "corporate buzzword wellness burnout hustle culture absurd 2026",
    ],
  },
];

/**
 * General breaking business news — stored with pillar: "general".
 * Available to all journalist agents via the context builder.
 */
export const GENERAL_BREAKING_QUERY =
  "major breaking business news corporate today 2026";
