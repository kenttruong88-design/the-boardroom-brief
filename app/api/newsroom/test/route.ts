import { NextResponse } from "next/server";
import { JOURNALIST_PERSONAS } from "@/app/lib/agents/personas";
import { buildDailyContext } from "@/app/lib/agents/context-builder";
import { selectTopics } from "@/app/lib/agents/topic-selector";
import { writeArticle } from "@/app/lib/agents/article-writer";
import { reviewArticle, reviseArticle } from "@/app/lib/agents/editor-review";

// Test route — runs ONE agent (Markets Floor), writes ONE article,
// skips email, returns full draft + review as JSON.
// Use this to verify the pipeline end-to-end before burning credits on a full run.

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runTest();
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runTest();
}

async function runTest() {
  const startedAt = Date.now();

  // Always test with Markets Floor agent
  const persona = JOURNALIST_PERSONAS.find((p) => p.pillar === "markets-floor")!;
  console.log(`[newsroom/test] Starting single-agent test with ${persona.name}…`);

  // Step 1 — Build context
  console.log("[newsroom/test] Building context…");
  const context = await buildDailyContext(persona.pillar);

  // Step 2 — Select topics (take only the first one)
  console.log("[newsroom/test] Selecting topics…");
  const topics = await selectTopics(persona, context);
  const topic = topics[0];
  if (!topic) {
    return NextResponse.json({ error: "No topics selected" }, { status: 500 });
  }
  console.log(`[newsroom/test] Topic selected: "${topic.title}"`);

  // Step 3 — Write one article
  console.log("[newsroom/test] Writing article…");
  const draft = await writeArticle(persona, topic);
  console.log(`[newsroom/test] Draft complete: "${draft.headline}"`);

  // Step 4 — Review
  console.log("[newsroom/test] Reviewing article…");
  let review = await reviewArticle(draft, 0);
  console.log(`[newsroom/test] Score: ${review.score}/10 — ${review.passed ? "PASSED" : "FAILED"}`);

  let revisedDraft = draft;
  let revisionAttempted = false;

  if (!review.passed) {
    console.log("[newsroom/test] Requesting revision…");
    revisionAttempted = true;
    revisedDraft = await reviseArticle(persona, draft, review);
    review = await reviewArticle(revisedDraft, 0);
    console.log(`[newsroom/test] Revised score: ${review.score}/10 — ${review.passed ? "PASSED" : "DROPPED"}`);
  }

  const duration = Date.now() - startedAt;
  console.log(`[newsroom/test] Complete in ${duration}ms`);

  return NextResponse.json({
    agent: persona.name,
    pillar: persona.pillar,
    topicSelected: topic,
    draft: revisedDraft,
    review,
    revisionAttempted,
    passed: review.passed,
    durationMs: duration,
  });
}
