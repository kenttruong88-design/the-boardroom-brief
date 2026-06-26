import { createAdminClient } from "@/app/lib/supabase-server";
import { client as sanityClient } from "@/app/lib/sanity";
import type { TopicContext } from "./topic-selector";

/** Fetch zero-result search queries from last 7 days -- content gaps worth covering. */
async function getSearchGaps(supabase: ReturnType<typeof createAdminClient>): Promise<string[]> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("search_analytics")
      .select("query")
      .eq("result_count", 0)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!data || data.length === 0) return [];

    const counts: Record<string, number> = {};
    for (const row of data) {
      const key = row.query.toLowerCase().trim();
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query]) => query);
  } catch {
    return [];
  }
}

/** Fetch top breaking stories from news_feed for this pillar (populated by the intel agent). */
async function getNewsFeedStories(
  supabase: ReturnType<typeof createAdminClient>,
  pillarSlug: string
): Promise<TopicContext["newsFeedStories"]> {
  try {
    const { data } = await supabase
      .from("news_feed")
      .select("headline, summary, url, source_name, relevance_score, satirical_score, key_facts, notable_quote, suggested_angle")
      .or(`pillar.eq.${pillarSlug},pillar.eq.general`)
      .gt("expires_at", new Date().toISOString())
      .order("relevance_score", { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return [];

    return data.map((row: {
      headline: string;
      summary: string;
      url: string | null;
      source_name: string | null;
      relevance_score: number;
      satirical_score: number;
      key_facts: string[] | null;
      notable_quote: string | null;
      suggested_angle: string | null;
    }) => ({
      headline:       row.headline,
      summary:        row.summary,
      url:            row.url ?? undefined,
      sourceName:     row.source_name ?? undefined,
      relevanceScore: row.relevance_score,
      satiricalScore: row.satirical_score,
      keyFacts:       row.key_facts ?? [],
      notableQuote:   row.notable_quote ?? undefined,
      suggestedAngle: row.suggested_angle ?? undefined,
    }));
  } catch {
    return [];
  }
}

// Static trending topics -- fallback when news_feed is empty
const TRENDING_TOPICS: string[] = [
  "AI adoption and productivity impact across industries",
  "Interest rate decisions and central bank forward guidance",
  "Trade policy shifts and tariff escalation",
  "Labour market tightening and wage growth pressure",
  "Energy transition costs and corporate net-zero commitments",
  "Supply chain re-shoring and friend-shoring trends",
  "Commercial real estate stress and office vacancy rates",
  "Sovereign debt levels and fiscal sustainability concerns",
  "Emerging market currency volatility",
  "Private equity dry powder and deal flow slowdown",
];

export async function buildDailyContext(pillarSlug: string): Promise<TopicContext> {
  const todayDate = new Date().toISOString().split("T")[0];
  const supabase = createAdminClient();

  const [
    recentArticleTitles,
    marketSnapshotRaw,
    macroSnapshotRaw,
    recentEarnings,
    searchGaps,
    newsFeedStories,
  ] = await Promise.all([

    // ── 1. Recent article titles from Sanity (last 7 days, same pillar) ──────
    (async (): Promise<string[]> => {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const articles = await sanityClient?.fetch<{ title: string }[]>(
          `*[_type == "article" && pillar->slug.current == $pillarSlug && publishedAt >= $since]
           | order(publishedAt desc) [0...20] { title }`,
          { pillarSlug, since: sevenDaysAgo },
          { next: { revalidate: 60 } }
        ) ?? [];
        return articles.map((a) => a.title);
      } catch {
        return [];
      }
    })(),

    // ── 2. Market snapshot from market_cache (top 10 symbols) ────────────────
    (async (): Promise<object> => {
      try {
        const { data } = await supabase
          .from("market_cache")
          .select("symbol, name, price, change_pct, pulled_at")
          .order("pulled_at", { ascending: false })
          .limit(10);

        if (!data || data.length === 0) return {};

        return data.reduce(
          (acc: Record<string, unknown>, row: { symbol: string; name: string; price: number; change_pct: number; pulled_at: string }) => ({
            ...acc,
            [row.symbol]: {
              name:      row.name,
              price:     row.price,
              changePct: row.change_pct,
              asOf:      row.pulled_at,
            },
          }),
          {} as Record<string, unknown>
        );
      } catch {
        return {};
      }
    })(),

    // ── 3. Macro snapshot from macro_cache (latest per country) ──────────────
    (async (): Promise<object> => {
      try {
        const { data } = await supabase
          .from("macro_cache")
          .select("country_slug, indicator, value, period, pulled_at")
          .order("pulled_at", { ascending: false })
          .limit(30);

        if (!data || data.length === 0) return {};

        const seen = new Set<string>();
        const deduped = data.filter((row: { country_slug: string; indicator: string }) => {
          const key = `${row.country_slug}:${row.indicator}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        return deduped.reduce(
          (acc: Record<string, unknown>, row: { country_slug: string; indicator: string; value: number; period: string; pulled_at: string }) => ({
            ...acc,
            [`${row.country_slug}/${row.indicator}`]: {
              value:  row.value,
              period: row.period,
              asOf:   row.pulled_at,
            },
          }),
          {} as Record<string, unknown>
        );
      } catch {
        return {};
      }
    })(),

    // ── 4. Recent earnings from earnings_covered (last 48 hours) ─────────────
    (async (): Promise<object[]> => {
      try {
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("earnings_covered")
          .select("ticker, company_name, reported_at, eps_actual, eps_estimate, revenue_actual, revenue_estimate, beat")
          .gte("reported_at", fortyEightHoursAgo)
          .order("reported_at", { ascending: false });

        return data ?? [];
      } catch {
        return [];
      }
    })(),

    // ── 5. Search gaps (zero-result reader queries) ───────────────────────────
    getSearchGaps(supabase),

    // ── 6. Breaking news from news_feed (populated by the intel agent) ────────
    getNewsFeedStories(supabase, pillarSlug),
  ]);

  return {
    todayDate,
    recentArticleTitles,
    marketSnapshot:  marketSnapshotRaw,
    macroSnapshot:   macroSnapshotRaw,
    recentEarnings,
    trendingTopics:  TRENDING_TOPICS,
    searchGaps,
    newsFeedStories,
  };
}
