import { createHash } from "crypto";
import { createAdminClient } from "@/app/lib/supabase-server";

export interface RawStory {
  headline: string;
  summary: string;
  url?: string;
  sourceName?: string;
  pillar: string;
  region: string;
  countries?: string[];
  marketSymbols?: string[];
  relevanceScore?: number;
  satiricalScore?: number;
}

// ── generateHeadlineHash ──────────────────────────────────────────────────────

export function generateHeadlineHash(headline: string): string {
  return createHash("sha256")
    .update(headline.toLowerCase().trim())
    .digest("hex");
}

// ── getExistingHashes ─────────────────────────────────────────────────────────

export async function getExistingHashes(): Promise<string[]> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("news_feed")
    .select("headline_hash")
    .gte("fetched_at", cutoff)
    .not("headline_hash", "is", null);

  if (error) {
    console.error("[deduplicator] Failed to fetch existing hashes:", error.message);
    return [];
  }

  return (data ?? []).map((row: { headline_hash: string }) => row.headline_hash);
}

// ── filterNewStories ──────────────────────────────────────────────────────────

export function filterNewStories(
  stories: RawStory[],
  existingHashes: string[]
): RawStory[] {
  const existingSet = new Set(existingHashes);

  return stories.filter((story) => {
    const hash = generateHeadlineHash(story.headline);
    return !existingSet.has(hash);
  });
}
