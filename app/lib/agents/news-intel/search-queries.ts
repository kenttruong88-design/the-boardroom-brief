export interface RegionalQuery {
  region: string;
  countries: string[];
  queries: string[];
}

export interface PillarQuery {
  pillar: string;
  queries: string[];
}

// ── Regional search query matrix ─────────────────────────────────────────────
// ~7 queries per region × 5 regions = 35 regional searches

export const REGIONAL_QUERIES: RegionalQuery[] = [
  {
    region: "americas",
    countries: ["united-states", "canada", "mexico", "brazil", "argentina", "colombia"],
    queries: [
      "US economy Federal Reserve interest rates inflation 2026",
      "Wall Street earnings S&P 500 corporate results",
      "Canada Bank of Canada monetary policy GDP",
      "Latin America Brazil Mexico trade investment",
      "Americas central bank policy rate decision",
      "US trade tariffs trade policy WTO",
      "North America labour market unemployment jobs",
    ],
  },
  {
    region: "europe",
    countries: ["germany", "france", "united-kingdom", "italy", "spain", "netherlands", "sweden"],
    queries: [
      "ECB European Central Bank interest rates eurozone",
      "Germany DAX industrial output recession",
      "UK Bank of England inflation GDP growth",
      "European Union trade policy regulation",
      "France CAC 40 corporate earnings",
      "Scandinavia Nordic economy business",
      "Europe energy transition cost corporate investment",
    ],
  },
  {
    region: "asia-pacific",
    countries: ["china", "japan", "india", "south-korea", "australia", "indonesia", "taiwan"],
    queries: [
      "China economy PBOC property market trade",
      "Japan Bank of Japan yen interest rates",
      "India RBI GDP growth corporate earnings",
      "Asia Pacific supply chain semiconductor manufacturing",
      "South Korea Samsung TSMC technology exports",
      "Australia RBA commodities mining investment",
      "ASEAN Southeast Asia trade investment growth",
    ],
  },
  {
    region: "middle-east",
    countries: ["saudi-arabia", "uae", "turkey", "egypt", "qatar", "kuwait"],
    queries: [
      "Saudi Arabia Vision 2030 oil Aramco investment",
      "UAE Dubai financial markets sovereign wealth",
      "OPEC oil production crude prices energy",
      "Middle East sovereign wealth fund investment",
      "Turkey inflation lira central bank",
      "Gulf Cooperation Council GCC economy trade",
      "Middle East business investment fintech",
    ],
  },
  {
    region: "africa",
    countries: ["south-africa", "nigeria", "kenya", "egypt", "ethiopia", "ghana"],
    queries: [
      "Africa economic growth investment infrastructure",
      "Nigeria economy oil revenue currency",
      "South Africa rand GDP Reserve Bank",
      "Kenya East Africa fintech mobile money startup",
      "Africa trade AfCFTA continental free trade",
      "Sub-Saharan Africa business investment 2026",
      "Africa energy transition commodity exports",
    ],
  },
];

// ── Pillar-targeted search query matrix ───────────────────────────────────────
// ~7 queries per pillar = 35 pillar searches
// Total across both matrices: ~70 searches — capped to ~35 per run by sampling

export const PILLAR_QUERIES: PillarQuery[] = [
  {
    pillar: "markets-floor",
    queries: [
      "stock market index rally selloff today 2026",
      "forex currency volatility central bank intervention",
      "commodities gold oil copper price movement",
      "bond yields treasury spread inversion",
      "hedge fund institutional investor positioning",
      "IPO listing valuation market debut",
      "cryptocurrency bitcoin ethereum market 2026",
    ],
  },
  {
    pillar: "macro-mondays",
    queries: [
      "inflation CPI PPI data release central bank",
      "GDP growth recession contraction quarterly data",
      "unemployment jobs report labour market tightening",
      "central bank rate decision forward guidance 2026",
      "government fiscal policy deficit spending budget",
      "trade balance current account surplus deficit",
      "sovereign debt IMF World Bank outlook",
    ],
  },
  {
    pillar: "c-suite-circus",
    queries: [
      "CEO departure resignation fired appointed 2026",
      "corporate earnings quarterly results beat miss",
      "merger acquisition deal announced billion",
      "layoffs restructuring workforce reduction corporate",
      "executive pay compensation board shareholder",
      "corporate strategy pivot transformation plan",
      "private equity buyout portfolio company deal",
    ],
  },
  {
    pillar: "global-office",
    queries: [
      "return to office mandate remote work policy 2026",
      "workplace culture employee productivity survey",
      "labour union strike industrial action workers",
      "diversity equity inclusion corporate policy",
      "four-day work week flexible working global",
      "corporate relocation headquarters talent migration",
      "global workforce trend hiring freeze layoff",
    ],
  },
  {
    pillar: "water-cooler",
    queries: [
      "LinkedIn viral post corporate cringe professional",
      "office culture workplace absurdity trend 2026",
      "corporate buzzword jargon synergy disruption",
      "CEO tweet social media controversy corporate",
      "work from home remote office debate funny",
      "corporate wellness programme employee burnout",
      "hustle culture productivity toxic workplace",
    ],
  },
];
