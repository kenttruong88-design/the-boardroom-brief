import { createAdminClient } from "@/app/lib/supabase-server";
import { REGIONAL_QUERIES, PILLAR_QUERIES } from "./search-queries";
import { runSearchBatch, storeStories } from "./intel-agent";
import type { RawStory } from "./deduplicator";

export interface NewsIntelResult {
  storiesFound: number;
  storiesStored: number;
  duplicatesSkipped: number;
  searchesRun: number;
  durationMs: number;
  errors: string[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runNewsIntelAgent(): Promise<NewsIntelResult> {
  const startedAt = Date.now();
  const errors: string[] = [];
  const allStories: RawStory[] = [];
  let searchesRun = 0;

  console.log("[news-intel] Starting News Intelligence Agent…");

  // ── STEP 1 — Regional sweeps (sequential, one region at a time) ─────────────
  console.log(`[news-intel] Step 1: Regional sweeps (${REGIONAL_QUERIES.length} regions)…`);

  for (let i = 0; i < REGIONAL_QUERIES.length; i++) {
    const entry = REGIONAL_QUERIES[i];
    console.log(`[news-intel] Region ${i + 1}/${REGIONAL_QUERIES.length}: ${entry.region} (${entry.queries.length} queries)…`);

    try {
      const stories = await runSearchBatch(entry.queries, "general", entry.region);
      allStories.push(...stories);
      searchesRun += entry.queries.length;
      console.log(`[news-intel] ${entry.region}: ${stories.length} stories found.`);
    } catch (err) {
      const msg = `Regional sweep failed for ${entry.region}: ${(err as Error).message}`;
      console.error(`[news-intel] ${msg}`);
      errors.push(msg);
    }

    if (i < REGIONAL_QUERIES.length - 1) {
      await sleep(3000);
    }
  }

  console.log(`[news-intel] Step 1 complete. ${allStories.length} stories from regional sweeps.`);

  // ── STEP 2 — Pillar deep dives (sequential, one pillar at a time) ─────────────
  console.log(`[news-intel] Step 2: Pillar deep dives (${PILLAR_QUERIES.length} pillars)…`);

  for (let i = 0; i < PILLAR_QUERIES.length; i++) {
    const entry = PILLAR_QUERIES[i];
    console.log(`[news-intel] Pillar ${i + 1}/${PILLAR_QUERIES.length}: ${entry.pillar} (${entry.queries.length} queries)…`);

    try {
      const stories = await runSearchBatch(entry.queries, entry.pillar, "global");
      allStories.push(...stories);
      searchesRun += entry.queries.length;
      console.log(`[news-intel] ${entry.pillar}: ${stories.length} stories found.`);
    } catch (err) {
      const msg = `Pillar deep dive failed for ${entry.pillar}: ${(err as Error).message}`;
      console.error(`[news-intel] ${msg}`);
      errors.push(msg);
    }

    if (i < PILLAR_QUERIES.length - 1) {
      await sleep(3000);
    }
  }

  const storiesFound = allStories.length;
  console.log(`[news-intel] Step 2 complete. ${storiesFound} total stories collected.`);

  // ── STEP 3 — Store all collected stories ─────────────────────────────────────
  console.log("[news-intel] Step 3: Storing stories…");
  let storiesStored = 0;

  try {
    storiesStored = await storeStories(allStories);
    const duplicatesSkipped = storiesFound - storiesStored;
    console.log(`[news-intel] Stored ${storiesStored} new stories, skipped ${duplicatesSkipped} duplicates.`);
  } catch (err) {
    const msg = `Store failed: ${(err as Error).message}`;
    console.error(`[news-intel] ${msg}`);
    errors.push(msg);
  }

  const duplicatesSkipped = storiesFound - storiesStored;

  // ── STEP 4 — Cleanup expired stories ─────────────────────────────────────────
  console.log("[news-intel] Step 4: Cleaning up expired stories…");

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

  // ── STEP 5 — Log the run ──────────────────────────────────────────────────────
  const durationMs = Date.now() - startedAt;
  console.log(`[news-intel] Step 5: Logging run. Duration: ${durationMs}ms`);

  try {
    const supabase = createAdminClient();
    await supabase.from("news_intel_runs").insert({
      ran_at: new Date().toISOString(),
      stories_found: storiesFound,
      stories_stored: storiesStored,
      duplicates_skipped: duplicatesSkipped,
      searches_run: searchesRun,
      duration_ms: durationMs,
      errors,
    });
  } catch (err) {
    console.error("[news-intel] Failed to log run:", (err as Error).message);
  }

  console.log(`[news-intel] Complete. ${storiesFound} found, ${storiesStored} stored, ${durationMs}ms.`);

  return {
    storiesFound,
    storiesStored,
    duplicatesSkipped,
    searchesRun,
    durationMs,
    errors,
  };
}
