import { createAdminClient } from "./supabase-server";

/**
 * Bulk-fetch approved comment counts for a list of article slugs.
 * Returns a map of { slug → count }. Missing keys = 0.
 */
export async function getCommentCounts(
  articleIds: string[]
): Promise<Record<string, number>> {
  if (articleIds.length === 0) return {};
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("comments")
      .select("article_id")
      .in("article_id", articleIds)
      .eq("status", "approved")
      .is("deleted_at", null);

    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { article_id: string }[]) {
      counts[row.article_id] = (counts[row.article_id] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}
