import { createServerSupabaseClient } from "@/app/lib/supabase-server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { NextResponse } from "next/server";
import type { DailyDigest } from "@/app/lib/agents/types";

export function todayDate() {
  return new Date().toISOString().split("T")[0];
}

/** Verifies the caller has a valid Supabase session via cookie. */
export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return { userId: user.id };
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export interface DigestRow {
  digest_json: DailyDigest;
  articles_approved: number;
  articles_rejected: number;
  created_at: string;
}

/** Loads today's digest row from Supabase. */
export async function loadDigest(date = todayDate()): Promise<DigestRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("daily_digest")
    .select("digest_json, articles_approved, articles_rejected, created_at")
    .eq("date", date)
    .single();
  if (error || !data) return null;
  return data as DigestRow;
}

/** Patches digest_json back into Supabase. */
export async function saveDigest(digest: DailyDigest, date = todayDate()): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("daily_digest")
    .update({ digest_json: digest })
    .eq("date", date);
}

/** Resolves an articleId (string index or "0", "1" …) to a numeric index. */
export function resolveIndex(articleId: string): number {
  const n = parseInt(articleId, 10);
  return isNaN(n) ? -1 : n;
}
