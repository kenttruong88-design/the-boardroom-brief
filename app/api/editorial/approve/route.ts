import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { createSanityArticle } from "@/app/lib/sanity-write";
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

  if ((entry as typeof entry & { approved?: boolean }).approved) {
    return NextResponse.json({ error: "Already approved" }, { status: 409 });
  }

  // Publish to Sanity
  let result;
  try {
    result = await createSanityArticle(entry.draft, "published");
  } catch (err) {
    console.error("[approve]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  // Mark approved in digest_json
  const digest = row.digest_json;
  (digest.articles[index] as typeof entry & { approved?: boolean; sanityDocId?: string }).approved = true;
  (digest.articles[index] as typeof entry & { approved?: boolean; sanityDocId?: string }).sanityDocId = result.sanityDocId;
  await saveDigest(digest, date);

  // Increment counter
  const supabase = createAdminClient();
  await supabase
    .from("daily_digest")
    .update({ articles_approved: (row.articles_approved ?? 0) + 1 })
    .eq("date", date);

  return NextResponse.json({
    success: true,
    sanityDocId: result.sanityDocId,
    publishedUrl: result.publishedUrl,
  });
}
