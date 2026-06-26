/**
 * intel-agent.ts
 *
 * Replaced web_search_20250305 with RSS-first approach:
 *   1. RSS fetcher pulls headlines for free (Google News, no API key)
 *   2. Single token-only Claude call per pillar scores and structures them
 *   3. No per-search $0.01 charge — just Haiku token costs (~$0.01/day total)
 */

import Anthropic from "@anthropic-ai/sdk";
import { logClaudeUsage, MODELS } from "@/app/lib/claude";
import { createAdminClient } from "@/app/lib/supabase-server";
import {
  generateHeadlineHash,
  filterNewStories,
  getExistingHashes,
} from "./deduplicator";
import type { RawStory } from "./deduplicator";
import type { RSSItem } from "./rss-fetcher";

export type { RawStory };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── scorePillarStories ────────────────────────────────────────────────────────
// Single Claude call (no tools) that reads a batch of RSS headlines and
// outputs scored, structured stories ready for news_feed.

export async function scorePillarStories(
  pillar: string,
  pillarLabel: string,
  region: string,
  items: RSSItem[]
): Promise<RawStory[]> {
  if (items.length === 0) return [];

  // Build a URL lookup from original RSS items so we never use Claude's fabricated URLs
  const urlByHeadline = new Map<string, string>();
  for (const item of items) {
    if (item.url) {
      const key = item.headline.toLowerCase().replace(/[^a-z0-9]/g, "");
      urlByHeadline.set(key, item.url);
    }
  }

  const headlineList = items
    .map(
      (item, i) =>
        `${i + 1}. [${item.sourceName || "Unknown"}] ${item.headline}` +
        (item.description ? `\n   ${item.description.slice(0, 200)}` : "") +
        (item.publishedAt ? `\n   Published: ${item.publishedAt}` : "")
    )
    .join("\n\n");

  const systemPrompt = `You are the News Intelligence Agent for The Alignment Times, a financial satire publication covering the top 30 global economies.

Your job: from a batch of today's news headlines, select the most relevant and potentially satirisable stories for a specific content pillar. Be a sharp editorial eye — skip press releases, skip fluffy content, prioritise stories that a senior professional would find important or delightfully absurd.

CRITICAL RULES FOR FACTS:
- Only include keyFacts and notableQuote that are explicitly stated in the headline or snippet provided. Do NOT use your training knowledge to fill in facts.
- If the snippet does not contain a direct quote, set notableQuote to null.
- If the snippet does not contain specific numbers or named facts, set keyFacts to [].
- It is better to return fewer facts than to fabricate any.`;

  const userPrompt = `Content pillar: ${pillarLabel}

Today's news headlines (from RSS feeds):

${headlineList}

Select up to 8 of these stories that best fit the pillar. For each selected story, extract as much as you can from the headline and snippet.

Return only valid JSON array — no markdown, no explanation:
[{
  "headline": "the story headline (clean, no source suffix)",
  "summary": "2-3 sentence factual summary — use the snippet plus your knowledge of the story if you recognise it",
  "url": "the source URL if recognisable, otherwise leave as empty string",
  "sourceName": "publication name",
  "countries": ["2-letter ISO codes of relevant economies, up to 4"],
  "marketSymbols": ["relevant ticker symbols if any, e.g. AAPL, SPY"],
  "relevanceScore": 8,
  "satiricalScore": 6,
  "keyFacts": ["specific fact or number", "another concrete detail — up to 5, only real facts from the snippet"],
  "notableQuote": "verbatim quote from a named person if present in the snippet, otherwise null",
  "suggestedAngle": "the dry or satirical editorial take this story invites, 1 sentence"
}]

Return empty array [] if none of the headlines fit the pillar. Return only valid JSON.`;

  try {
    const response = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    logClaudeUsage(
      "pipeline:news-intel:score",
      MODELS.fast,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
    if (!cleaned || cleaned === "[]") return [];

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      console.warn(`[intel-agent] Expected JSON array, got ${typeof parsed} for pillar "${pillar}"`);
      return [];
    }

    type ScoredItem = {
      headline: string;
      summary: string;
      url?: string;
      sourceName?: string;
      countries?: string[];
      marketSymbols?: string[];
      relevanceScore?: number;
      satiricalScore?: number;
      keyFacts?: string[];
      notableQuote?: string | null;
      suggestedAngle?: string;
    };

    return (parsed as ScoredItem[])
      .filter((s) => s.headline && s.summary)
      .map((s) => {
        // Use original RSS URL instead of Claude's reconstructed one (prevents hallucinated URLs)
        const headlineKey = s.headline.toLowerCase().replace(/[^a-z0-9]/g, "");
        const resolvedUrl = urlByHeadline.get(headlineKey);

        return {
          headline:       s.headline,
          summary:        s.summary,
          url:            resolvedUrl,
          sourceName:     s.sourceName,
          pillar,
          region,
          countries:      s.countries ?? [],
          marketSymbols:  s.marketSymbols ?? [],
          relevanceScore: s.relevanceScore ?? 5,
          satiricalScore: s.satiricalScore ?? 3,
          headlineHash:   generateHeadlineHash(s.headline),
          keyFacts:       s.keyFacts?.filter(Boolean) ?? [],
          notableQuote:   s.notableQuote ?? undefined,
          suggestedAngle: s.suggestedAngle ?? undefined,
        };
      });
  } catch (err) {
    console.error(`[intel-agent] Scoring failed for pillar "${pillar}":`, (err as Error).message);
    return [];
  }
}

// ── storeStories ──────────────────────────────────────────────────────────────

export interface StoreResult {
  stored: number;
  duplicatesSkipped: number;
}

export async function storeStories(stories: RawStory[]): Promise<StoreResult> {
  if (stories.length === 0) return { stored: 0, duplicatesSkipped: 0 };

  const supabase = createAdminClient();

  const existingHashes = await getExistingHashes();
  const newStories = filterNewStories(stories, existingHashes);
  const duplicatesSkipped = stories.length - newStories.length;

  if (newStories.length === 0) {
    console.log("[intel-agent] All stories already in feed — nothing to store.");
    return { stored: 0, duplicatesSkipped };
  }

  const rows = newStories.map((s) => ({
    headline:        s.headline,
    summary:         s.summary,
    url:             s.url ?? null,
    source_name:     s.sourceName ?? null,
    pillar:          s.pillar,
    region:          s.region,
    countries:       s.countries ?? [],
    market_symbols:  s.marketSymbols ?? [],
    relevance_score: s.relevanceScore ?? 5,
    satirical_score: s.satiricalScore ?? 3,
    headline_hash:   generateHeadlineHash(s.headline),
    key_facts:       s.keyFacts && s.keyFacts.length > 0 ? s.keyFacts : null,
    notable_quote:   s.notableQuote ?? null,
    suggested_angle: s.suggestedAngle ?? null,
  }));

  const { error, data } = await supabase
    .from("news_feed")
    .upsert(rows, { onConflict: "headline_hash", ignoreDuplicates: true })
    .select("id");

  if (error) {
    throw new Error(`[intel-agent] Supabase upsert failed: ${error.message}`);
  }

  const stored = data?.length ?? 0;
  console.log(
    `[intel-agent] Stored ${stored}/${newStories.length} new stories ` +
    `(${duplicatesSkipped} duplicates skipped).`
  );
  return { stored, duplicatesSkipped };
}
