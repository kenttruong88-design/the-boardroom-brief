import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { requireAuth, loadDigest, saveDigest, resolveIndex, todayDate } from "../_helpers";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { articleId, digestDate } = await req.json() as {
    articleId: string;
    digestDate?: string;
  };

  const date = digestDate ?? todayDate();
  const index = resolveIndex(articleId);

  if (index < 0) {
    return NextResponse.json({ error: "Invalid articleId" }, { status: 400 });
  }

  const row = await loadDigest(date);
  if (!row) {
    return NextResponse.json({ error: "No digest for that date" }, { status: 404 });
  }

  const entry = row.digest_json.articles[index];
  if (!entry) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  // Mark rejected in digest_json
  const digest = row.digest_json;
  (digest.articles[index] as typeof entry & { rejected?: boolean }).rejected = true;
  await saveDigest(digest, date);

  // Increment counter
  const supabase = createAdminClient();
  await supabase
    .from("daily_digest")
    .update({ articles_rejected: (row.articles_rejected ?? 0) + 1 })
    .eq("date", date);

  return NextResponse.json({ success: true });
}
