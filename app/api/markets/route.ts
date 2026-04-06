import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase";
import { MOCK_MARKET_DATA } from "@/app/lib/market-fetcher";

export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("market_cache")
      .select("symbol, name, price, change_pct, economy_id, pulled_at")
      .order("pulled_at", { ascending: false });

    if (error || !data || data.length === 0) {
      // Fall back to mock data if DB is empty or unavailable
      return NextResponse.json(MOCK_MARKET_DATA, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
      });
    }

    // Deduplicate by symbol (keep latest)
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
      change: 0, // not stored — derive from changePct if needed
    }));

    return NextResponse.json(quotes, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json(MOCK_MARKET_DATA);
  }
}
