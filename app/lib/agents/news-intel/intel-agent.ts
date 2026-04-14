import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/app/lib/supabase-server";
import {
  generateHeadlineHash,
  filterNewStories,
  getExistingHashes,
} from "./deduplicator";
import type { RawStory } from "./deduplicator";

export type { RawStory };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── System prompt ─────────────────────────────────────────────────────────────

const NEWS_INTEL_SYSTEM_PROMPT = `You are the News Intelligence Agent for The Boardroom Brief, a financial satire news site covering the top 30 global economies. Your job is to find the most relevant, interesting, and potentially satirisable business and financial news stories from today.

You are looking for stories that fit these content pillars:
- Markets Floor: stocks, indices, forex, commodities, earnings
- Macro Mondays: GDP, inflation, unemployment, central bank decisions
- C-Suite Circus: CEO moves, layoffs, M&A, corporate scandals, earnings calls
- Global Office: workplace culture, labour laws, remote work, RTO mandates
- Water Cooler: viral corporate moments, LinkedIn culture, buzzwords, absurd PR

For each story you find, assess:
- Relevance score (1-10): How relevant is this to senior professionals?
- Satirical score (1-10): How much comedic or satirical potential does it have?
  10 = a CEO said something that writes itself
  7 = a corporate decision that invites dry commentary
  4 = straight news that needs framing
  1 = purely factual with no angle

Be a sharp editorial eye. Skip press releases. Skip fluffy content. Prioritise stories that a smart, senior professional would find either genuinely important or delightfully absurd.`;

// ── runSearchBatch ────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripFences(raw: string): string {
  return raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
}

export async function runSearchBatch(
  queries: string[],
  pillar: string,
  region: string
): Promise<RawStory[]> {
  const allStories: RawStory[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    try {
      const userPrompt = `Search for: ${query}

Find the 3 most relevant stories published in the last 24 hours. For each story return only valid JSON array:
[{
  "headline": "the actual story headline",
  "summary": "2-3 sentences, factual summary only",
  "url": "source URL",
  "sourceName": "publication name",
  "countries": ["2-letter country codes from our 30 economies"],
  "marketSymbols": ["relevant tickers if any"],
  "relevanceScore": 8,
  "satiricalScore": 6
}]

Only include stories from the last 24 hours. Return empty array [] if nothing relevant found. Return only valid JSON, no markdown.`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: NEWS_INTEL_SYSTEM_PROMPT,
        tools: [
          {
            type: "web_search_20250305" as const,
            name: "web_search",
          },
        ],
        messages: [{ role: "user", content: userPrompt }],
      });

      // Extract the final text block after tool use
      const textBlocks = response.content.filter((b) => b.type === "text");
      if (textBlocks.length === 0) {
        console.warn(`[intel-agent] No text response for query: "${query}"`);
        continue;
      }

      const raw = textBlocks
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");

      const cleaned = stripFences(raw);
      if (!cleaned || cleaned === "[]") continue;

      const parsed = JSON.parse(cleaned) as Array<{
        headline: string;
        summary: string;
        url?: string;
        sourceName?: string;
        countries?: string[];
        marketSymbols?: string[];
        relevanceScore?: number;
        satiricalScore?: number;
      }>;

      const stories: RawStory[] = parsed
        .filter((s) => s.headline && s.summary)
        .map((s) => ({
          headline: s.headline,
          summary: s.summary,
          url: s.url,
          sourceName: s.sourceName,
          pillar,
          region,
          countries: s.countries ?? [],
          marketSymbols: s.marketSymbols ?? [],
          relevanceScore: s.relevanceScore ?? 5,
          satiricalScore: s.satiricalScore ?? 3,
          headlineHash: generateHeadlineHash(s.headline),
        }));

      allStories.push(...stories);
      console.log(`[intel-agent] Query ${i + 1}/${queries.length}: "${query}" → ${stories.length} stories`);
    } catch (err) {
      console.error(`[intel-agent] Query failed: "${query}":`, (err as Error).message);
    }

    // Rate limit: 1.5s between queries
    if (i < queries.length - 1) {
      await sleep(1500);
    }
  }

  return allStories;
}

// ── storeStories ──────────────────────────────────────────────────────────────

export async function storeStories(stories: RawStory[]): Promise<number> {
  if (stories.length === 0) return 0;

  const supabase = createAdminClient();

  // Get existing hashes to deduplicate
  const existingHashes = await getExistingHashes();
  const newStories = filterNewStories(stories, existingHashes);

  if (newStories.length === 0) {
    console.log("[intel-agent] All stories already in feed — nothing to store.");
    return 0;
  }

  const rows = newStories.map((s) => ({
    headline: s.headline,
    summary: s.summary,
    url: s.url ?? null,
    source_name: s.sourceName ?? null,
    pillar: s.pillar,
    region: s.region,
    countries: s.countries ?? [],
    market_symbols: s.marketSymbols ?? [],
    relevance_score: s.relevanceScore ?? 5,
    satirical_score: s.satiricalScore ?? 3,
    headline_hash: s.headlineHash,
  }));

  // Upsert — headline_hash unique constraint handles any race conditions
  const { error, data } = await supabase
    .from("news_feed")
    .upsert(rows, { onConflict: "headline_hash", ignoreDuplicates: true })
    .select("id");

  if (error) {
    throw new Error(`[intel-agent] Supabase upsert failed: ${error.message}`);
  }

  const stored = data?.length ?? 0;
  console.log(`[intel-agent] Stored ${stored}/${newStories.length} new stories (${stories.length - newStories.length} duplicates skipped).`);
  return stored;
}
