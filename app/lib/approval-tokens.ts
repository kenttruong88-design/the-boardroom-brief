import { createAdminClient } from "@/app/lib/supabase-server";
import { randomUUID } from "crypto";

/** Generate one approval token per article index and store in Supabase.
 *  Tokens expire after 48 hours. Returns map of articleId → token string. */
export async function generateApprovalTokens(
  articleIds: string[],
  digestDate: string
): Promise<Record<string, string>> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const tokens: Record<string, string> = {};

  const rows = articleIds.map((articleId) => {
    const token = randomUUID();
    tokens[articleId] = token;
    return { article_id: articleId, digest_date: digestDate, token, expires_at: expiresAt };
  });

  // Conflict on (article_id, digest_date) so re-running the pipeline for the same
  // day replaces the old token, invalidating any already-sent email links.
  await supabase
    .from("approval_tokens")
    .upsert(rows, { onConflict: "article_id,digest_date" });

  return tokens;
}

/** Validates a one-click token. Returns articleId + digestDate if valid.
 *  Atomically marks the token used — concurrent calls with the same token
 *  will get null on all but the first. */
export async function consumeApprovalToken(
  token: string
): Promise<{ articleId: string; digestDate: string } | null> {
  const supabase = createAdminClient();

  // Single atomic UPDATE: only succeeds if the token exists, is not used,
  // and has not expired. Returns the row if exactly 1 row was updated.
  const { data, error } = await supabase
    .from("approval_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("article_id, digest_date")
    .single();

  if (error || !data) return null;

  return { articleId: data.article_id, digestDate: data.digest_date };
}
