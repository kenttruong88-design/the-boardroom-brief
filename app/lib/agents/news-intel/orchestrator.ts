/**
 * orchestrator.ts
 *
 * Runs the News Intelligence Agent using RSS feeds instead of web_search.
 *
 * Old approach: 70 sequential web_search calls → ~2 minutes, ~$0.97/day
 * New approach: 11 parallel RSS fetches + 6 parallel Claude scoring calls
 *               → ~15 seconds, ~$0.01/day
 */

import { createAdminClient } from "@/app/lib/supabase-server";
import { PILLAR_RSS_CONFIGS, GENERAL_BREAKING_QUERY } from "./search-queries";
import { fetchPillarFeeds, fetchRSSFeed } from "./rss-fetcher";
import { scorePillarStories, storeStories } from "./intel-agent";
import type { RawStory } from "./deduplicator";

export interface NewsIntelResult {
  storiesFound: number;
  storiesStored: number;
  duplicatesSkipped: number;
  searchesRun: number;
  durationMs: number;
  errors: string[];
}

export async function runNewsIntelAgent(): Promise<NewsIntelResult> {
  const startedAt = Date.now();
  const errors: string[] = [];

  console.log("[news-intel] Starting News Intelligence Agent (RSS mode)…");

  // ── STEP 1 — Fetch all RSS feeds in parallel ────────────────────────────────
  // 5 pillars × 2 queries + 1 general = 11 RSS fetches, all free, all parallel.

  console.log(
    `[news-intel] Step 1: Fetching RSS feeds for ${PILLAR_RSS_CONFIGS.length} pillars + general…`
  );

  const [pillarFeeds, generalItems] = await Promise.all([
    Promise.all(
      PILLAR_RSS_CONFIGS.map(async (config) => {
        try {
          const items = await fetchPillarFeeds(config.queries);
          console.log(`[news-intel] RSS: ${config.pillar} → ${items.length} items`);
          return { config, items };
        } catch (err) {
          const msg = `RSS fetch failed for ${config.pillar}: ${(err as Error).message}`;
          console.error(`[news-intel] ${msg}`);
          errors.push(msg);
          return { config, items: [] };
        }
      })
    ),
    fetchRSSFeed(GENERAL_BREAKING_QUERY).catch((err) => {
      console.warn("[news-intel] General RSS fetch failed:", (err as Error).message);
      return [];
    }),
  ]);

  console.log(`[news-intel] Step 1 complete. General feed: ${generalItems.length} items.`);

  // ── STEP 2 — Score all pillars in parallel ──────────────────────────────────
  // One token-only Claude Haiku call per pillar + one for general.
  // No web_search tool = no per-search charges.

  console.log("[news-intel] Step 2: Scoring stories with Claude…");

  const [pillarStoryArrays, generalStories] = await Promise.all([
    Promise.all(
      pillarFeeds.map(async ({ config, items }) => {
        if (items.length === 0) return [];
        try {
          const stories = await scorePillarStories(
            config.pillar,
            config.label,
            "global",
            items
          );
          console.log(`[news-intel] Scored: ${config.pillar} → ${stories.length} stories`);
          return stories;
        } catch (err) {
          const msg = `Scoring failed for ${config.pillar}: ${(err as Error).message}`;
          console.error(`[news-intel] ${msg}`);
          errors.push(msg);
          return [];
        }
      })
    ),
    generalItems.length > 0
      ? scorePillarStories(
          "general",
          "Major breaking business news relevant to any content pillar",
          "global",
          generalItems
        ).catch((err) => {
          console.warn("[news-intel] General scoring failed:", (err as Error).message);
          return [] as RawStory[];
        })
      : Promise.resolve([] as RawStory[]),
  ]);

  const allStories: RawStory[] = [
    ...pillarStoryArrays.flat(),
    ...generalStories,
  ];

  const storiesFound = allStories.length;
  console.log(`[news-intel] Step 2 complete. ${storiesFound} stories scored.`);

  // ── STEP 3 — Store all collected stories ────────────────────────────────────

  console.log("[news-intel] Step 3: Storing stories…");
  let storiesStored = 0;

  try {
    storiesStored = await storeStories(allStories);
    console.log(`[news-intel] Stored ${storiesStored}/${storiesFound} stories.`);
  } catch (err) {
    const msg = `Store failed: ${(err as Error).message}`;
    console.error(`[news-intel] ${msg}`);
    errors.push(msg);
  }

  const duplicatesSkipped = storiesFound - storiesStored;

  // ── STEP 4 — Cleanup expired stories ────────────────────────────────────────

  try {
    const supabase = createAdminClient();
    const { data: deleted, error } = await supabase
      .from("news_feed")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (error) throw new Error(error.message);
    console.log(`[news-intel] Deleted ${deleted?.length ?? 0} expired stories.`);
  } catch (err) {
    const msg = `Cleanup failed: ${(err as Error).message}`;
    console.error(`[news-intel] ${msg}`);
    errors.push(msg);
  }

  // ── STEP 5 — Log the run ─────────────────────────────────────────────────────

  const durationMs = Date.now() - startedAt;
  const searchesRun = PILLAR_RSS_CONFIGS.length * 2 + 1; // RSS fetches (free)

  try {
    const supabase = createAdminClient();
    await supabase.from("news_intel_runs").insert({
      ran_at:             new Date().toISOString(),
      stories_found:      storiesFound,
      stories_stored:     storiesStored,
      duplicates_skipped: duplicatesSkipped,
      searches_run:       searchesRun,
      duration_ms:        durationMs,
      errors,
    });
  } catch (err) {
    console.error("[news-intel] Failed to log run:", (err as Error).message);
  }

  console.log(
    `[news-intel] Complete. ${storiesFound} found, ${storiesStored} stored, ` +
    `${durationMs}ms (was ~120,000ms with web_search).`
  );

  return {
    storiesFound,
    storiesStored,
    duplicatesSkipped,
    searchesRun,
    durationMs,
    errors,
  };
}
