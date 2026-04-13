import { createAdminClient } from "@/app/lib/supabase-server";
import { getArticlesByPillar } from "@/app/lib/queries";
import type { TopicContext } from "./topic-selector";

// Static trending topics — replace with live Google Trends proxy when ready
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

  // ── 1. Recent article titles from Sanity (last 7 days, same pillar) ──────────
  let recentArticleTitles: string[] = [];
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const articles = await getArticlesByPillar(pillarSlug, 20);
    recentArticleTitles = articles
      .filter((a) => a.publishedAt >= sevenDaysAgo)
      .map((a) => a.title);
  } catch {
    // Sanity unavailable — proceed with empty list
  }

  // ── 2. Market snapshot from Supabase market_cache (top 10 symbols) ───────────
  let marketSnapshot: object = {};
  try {
    const { data } = await supabase
      .from("market_cache")
      .select("symbol, name, price, change_pct, pulled_at")
      .order("pulled_at", { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      marketSnapshot = data.reduce(
        (acc, row) => ({
          ...acc,
          [row.symbol]: {
            name: row.name,
            price: row.price,
            changePct: row.change_pct,
            asOf: row.pulled_at,
          },
        }),
        {} as Record<string, unknown>
      );
    }
  } catch {
    // Supabase unavailable — proceed with empty snapshot
  }

  // ── 3. Macro snapshot from Supabase macro_cache (latest per country) ─────────
  let macroSnapshot: object = {};
  try {
    const { data } = await supabase
      .from("macro_cache")
      .select("country_slug, indicator, value, period, pulled_at")
      .order("pulled_at", { ascending: false })
      .limit(30);

    if (data && data.length > 0) {
      const seen = new Set<string>();
      const deduped = data.filter((row) => {
        const key = `${row.country_slug}:${row.indicator}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      macroSnapshot = deduped.reduce(
        (acc, row) => ({
          ...acc,
          [`${row.country_slug}/${row.indicator}`]: {
            value: row.value,
            period: row.period,
            asOf: row.pulled_at,
          },
        }),
        {} as Record<string, unknown>
      );
    }
  } catch {
    // macro_cache table may not exist yet — proceed with empty snapshot
  }

  // ── 4. Recent earnings from earnings_covered (last 48 hours) ─────────────────
  let recentEarnings: object[] = [];
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("earnings_covered")
      .select("ticker, company_name, reported_at, eps_actual, eps_estimate, revenue_actual, revenue_estimate, beat")
      .gte("reported_at", fortyEightHoursAgo)
      .order("reported_at", { ascending: false });

    if (data && data.length > 0) {
      recentEarnings = data;
    }
  } catch {
    // earnings_covered table may not exist yet — proceed with empty list
  }

  return {
    todayDate,
    recentArticleTitles,
    marketSnapshot,
    macroSnapshot,
    recentEarnings,
    trendingTopics: TRENDING_TOPICS,
  };
}
