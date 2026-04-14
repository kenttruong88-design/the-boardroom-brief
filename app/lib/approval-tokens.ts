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

  await supabase
    .from("approval_tokens")
    .upsert(rows, { onConflict: "token", ignoreDuplicates: true });

  return tokens;
}

/** Validates a one-click token. Returns articleId + digestDate if valid.
 *  Marks the token as used atomically. */
export async function consumeApprovalToken(
  token: string
): Promise<{ articleId: string; digestDate: string } | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("approval_tokens")
    .select("id, article_id, digest_date, expires_at, used_at")
    .eq("token", token)
    .single();

  if (error || !data) return null;
  if (data.used_at) return null; // already used
  if (new Date(data.expires_at) < new Date()) return null; // expired

  // Mark used
  await supabase
    .from("approval_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { articleId: data.article_id, digestDate: data.digest_date };
}
