import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { requireAuth } from "../_helpers";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();

  // Fetch all non-expired stories, ordered by relevance desc
  const { data: stories, error: storiesError } = await supabase
    .from("news_feed")
    .select(
      "id, headline, summary, url, source_name, pillar, region, countries, market_symbols, relevance_score, satirical_score, used_by_agent, used_at, fetched_at"
    )
    .gt("expires_at", new Date().toISOString())
    .order("relevance_score", { ascending: false })
    .limit(500);

  if (storiesError) {
    return NextResponse.json({ error: storiesError.message }, { status: 500 });
  }

  // Fetch the most recent intel run
  const { data: lastRun } = await supabase
    .from("news_intel_runs")
    .select("ran_at, stories_found, stories_stored, searches_run, duration_ms")
    .order("ran_at", { ascending: false })
    .limit(1)
    .single();

  const feed = stories ?? [];

  type FeedRow = NonNullable<typeof stories>[number];

  const usedCount = feed.filter((s: FeedRow) => s.used_by_agent).length;
  const unusedCount = feed.length - usedCount;
  const avgRelevance =
    feed.length > 0
      ? Math.round((feed.reduce((sum: number, s: FeedRow) => sum + (s.relevance_score ?? 0), 0) / feed.length) * 10) / 10
      : 0;
  const avgSatire =
    feed.length > 0
      ? Math.round((feed.reduce((sum: number, s: FeedRow) => sum + (s.satirical_score ?? 0), 0) / feed.length) * 10) / 10
      : 0;

  return NextResponse.json({
    stories: feed,
    lastRun: lastRun ?? null,
    stats: {
      total: feed.length,
      used: usedCount,
      unused: unusedCount,
      avgRelevance,
      avgSatire,
    },
  });
}
