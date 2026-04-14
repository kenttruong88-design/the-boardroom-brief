import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { JOURNALIST_PERSONAS } from "@/app/lib/agents/personas";
import { reviseArticle, reviewArticle } from "@/app/lib/agents/editor-review";
import type { DailyDigest } from "@/app/lib/agents/types";

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

export async function POST(req: Request) {
  const { articleIndex } = await req.json() as { articleIndex: number };

  if (articleIndex === undefined || articleIndex === null) {
    return NextResponse.json({ error: "articleIndex required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Load today's digest
  const { data, error } = await supabase
    .from("daily_digest")
    .select("digest_json")
    .eq("date", todayDate())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "No digest for today" }, { status: 404 });
  }

  const digest = data.digest_json as DailyDigest;
  const entry = digest.articles[articleIndex];

  if (!entry) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const persona = JOURNALIST_PERSONAS.find((p) => p.pillar === entry.draft.pillar);
  if (!persona) {
    return NextResponse.json({ error: "No persona found for pillar" }, { status: 400 });
  }

  // Run one revision attempt through journalist + re-review
  const revisedDraft = await reviseArticle(persona, entry.draft, entry.review);
  const newReview = await reviewArticle(revisedDraft, articleIndex);

  // Patch the digest in Supabase
  digest.articles[articleIndex] = { draft: revisedDraft, review: newReview };
  if (newReview.passed) {
    digest.passedArticles = (digest.passedArticles ?? 0) + 1;
    digest.rejectedArticles = Math.max(0, (digest.rejectedArticles ?? 1) - 1);
  }

  await supabase
    .from("daily_digest")
    .update({ digest_json: digest })
    .eq("date", todayDate());

  return NextResponse.json({
    score: newReview.score,
    passed: newReview.passed,
    notes: newReview.notes,
  });
}
