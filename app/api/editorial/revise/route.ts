import { NextResponse } from "next/server";
import { JOURNALIST_PERSONAS } from "@/app/lib/agents/personas";
import { reviseArticle, reviewArticle } from "@/app/lib/agents/editor-review";
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

  const persona = JOURNALIST_PERSONAS.find((p) => p.pillar === entry.draft.pillar);
  if (!persona) {
    return NextResponse.json({ error: "No persona for pillar" }, { status: 400 });
  }

  // Run revision through journalist + re-review
  const revisedDraft = await reviseArticle(persona, entry.draft, entry.review);
  const newReview = await reviewArticle(revisedDraft, index);

  // Patch digest
  const digest = row.digest_json;
  digest.articles[index] = { draft: revisedDraft, review: newReview };
  if (newReview.passed && !entry.review.passed) {
    digest.passedArticles = (digest.passedArticles ?? 0) + 1;
    digest.rejectedArticles = Math.max(0, (digest.rejectedArticles ?? 1) - 1);
  }
  await saveDigest(digest, date);

  return NextResponse.json({
    success: true,
    newScore: newReview.score,
    passed: newReview.passed,
    notes: newReview.notes,
  });
}
