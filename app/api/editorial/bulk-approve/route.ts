import { NextResponse } from "next/server";
import { createSanityArticle } from "@/app/lib/sanity-write";
import { createAdminClient } from "@/app/lib/supabase-server";
import { requireAuth, loadDigest, saveDigest, todayDate } from "../_helpers";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { digestDate } = await req.json() as { digestDate?: string };
  const date = digestDate ?? todayDate();

  const row = await loadDigest(date);
  if (!row) {
    return NextResponse.json({ error: "No digest for that date" }, { status: 404 });
  }

  const digest = row.digest_json;
  const publishedUrls: string[] = [];
  let approvedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < digest.articles.length; i++) {
    const entry = digest.articles[i] as typeof digest.articles[0] & {
      approved?: boolean;
      rejected?: boolean;
      sanityDocId?: string;
    };

    // Skip already actioned or below threshold
    if (entry.approved || entry.rejected) continue;
    if (!entry.review.passed || entry.review.score < 7.0) continue;

    try {
      const result = await createSanityArticle(entry.draft, "published");
      entry.approved = true;
      entry.sanityDocId = result.sanityDocId;
      publishedUrls.push(result.publishedUrl);
      approvedCount++;
    } catch (err) {
      console.error(`[bulk-approve] Failed for article ${i}:`, (err as Error).message);
      failedCount++;
    }
  }

  // Persist updated digest
  await saveDigest(digest, date);

  // Update counter
  const supabase = createAdminClient();
  await supabase
    .from("daily_digest")
    .update({ articles_approved: (row.articles_approved ?? 0) + approvedCount })
    .eq("date", date);

  return NextResponse.json({
    approvedCount,
    failedCount,
    publishedUrls,
  });
}
