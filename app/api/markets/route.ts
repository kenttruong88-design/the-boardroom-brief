import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase";
import { fetchAllMarketData, MOCK_MARKET_DATA } from "@/app/lib/market-fetcher";

export const revalidate = 300; // 5 minutes

export async function GET() {
  // 1 — Try Supabase cache first (populated by cron)
  try {
    const supabase = createAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("market_cache")
        .select("symbol, name, price, change_pct, economy_id, pulled_at")
        .order("pulled_at", { ascending: false });

      if (!error && data && data.length > 0) {
        type CacheRow = { symbol: string; name: string; price: number; change_pct: number; economy_id: string; pulled_at: string };
        const seen = new Set<string>();
        const deduplicated = (data as CacheRow[]).filter((row) => {
          if (seen.has(row.symbol)) return false;
          seen.add(row.symbol);
          return true;
        });
        const quotes = deduplicated.map((row) => ({
          symbol: row.symbol,
          name: row.name,
          economyId: row.economy_id,
          price: row.price,
          changePct: row.change_pct,
          change: 0,
        }));
        return NextResponse.json(quotes, {
          headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
        });
      }
    }
  } catch { /* fall through */ }

  // 2 — Cache empty: hit Polygon directly
  if (process.env.POLYGON_API_KEY) {
    try {
      const live = await fetchAllMarketData();
      if (live.length > 0) {
        return NextResponse.json(live, {
          headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
        });
      }
    } catch { /* fall through */ }
  }

  // 3 — Final fallback: mock data
  return NextResponse.json(MOCK_MARKET_DATA, {
    headers: { "Cache-Control": "public, s-maxage=60" },
  });
}
