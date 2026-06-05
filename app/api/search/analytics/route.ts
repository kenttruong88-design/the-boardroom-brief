import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase-server";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(30, Math.max(1, parseInt(searchParams.get("days") ?? "7", 10)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Run all queries in parallel
  const [topQueries, zeroResults, dailyVolume] = await Promise.all([

    // Top queries by frequency
    supabase
      .from("search_analytics")
      .select("query, result_count")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500),

    // Zero-result queries
    supabase
      .from("search_analytics")
      .select("query, created_at")
      .gte("created_at", since)
      .eq("result_count", 0)
      .order("created_at", { ascending: false })
      .limit(200),

    // Daily query volume
    supabase
      .from("search_analytics")
      .select("created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true }),
  ]);

  // Aggregate top queries
  const queryCounts: Record<string, { count: number; zeroResultCount: number }> = {};
  for (const row of topQueries.data ?? []) {
    const key = row.query.toLowerCase().trim();
    if (!queryCounts[key]) queryCounts[key] = { count: 0, zeroResultCount: 0 };
    queryCounts[key].count++;
    if (row.result_count === 0) queryCounts[key].zeroResultCount++;
  }

  const topQueriesList = Object.entries(queryCounts)
    .map(([query, { count, zeroResultCount }]) => ({ query, count, zeroResultCount }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Aggregate zero-result queries
  const zeroCounts: Record<string, number> = {};
  for (const row of zeroResults.data ?? []) {
    const key = row.query.toLowerCase().trim();
    zeroCounts[key] = (zeroCounts[key] ?? 0) + 1;
  }

  const zeroResultList = Object.entries(zeroCounts)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Aggregate daily volume
  const dailyCounts: Record<string, number> = {};
  for (const row of dailyVolume.data ?? []) {
    const day = row.created_at.slice(0, 10);
    dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
  }

  // Fill in missing days
  const volumeChart: { date: string; searches: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    volumeChart.push({ date: key, searches: dailyCounts[key] ?? 0 });
  }

  return NextResponse.json({
    totalSearches: (dailyVolume.data ?? []).length,
    topQueries: topQueriesList,
    zeroResultQueries: zeroResultList,
    dailyVolume: volumeChart,
  });
}
