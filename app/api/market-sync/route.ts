import { NextResponse } from "next/server";
import { fetchAllMarketData } from "@/app/lib/market-fetcher";
import { createAdminClient } from "@/app/lib/supabase-server";

// Protected with a secret header — set CRON_SECRET in env vars
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync();
}

// Vercel Cron calls GET
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync();
}

async function runSync() {
  const startedAt = Date.now();

  if (!process.env.POLYGON_API_KEY) {
    return NextResponse.json({ skipped: true, reason: "No POLYGON_API_KEY configured" });
  }

  const quotes = await fetchAllMarketData();

  if (quotes.length === 0) {
    return NextResponse.json({ synced: 0, duration: Date.now() - startedAt });
  }

  const supabase = createAdminClient();

  const rows = quotes.map((q) => ({
    symbol: q.symbol,
    name: q.name,
    price: q.price,
    change_pct: q.changePct,
    economy_id: q.economyId,
    pulled_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("market_cache")
    .upsert(rows, { onConflict: "symbol" });

  if (error) {
    console.error("[market-sync] Supabase upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    synced: rows.length,
    duration: Date.now() - startedAt,
    symbols: rows.map((r) => r.symbol),
  });
}
