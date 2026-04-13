import { NextResponse } from "next/server";
import { JOURNALIST_PERSONAS } from "@/app/lib/agents/personas";
import { buildDailyContext } from "@/app/lib/agents/context-builder";
import { selectTopics } from "@/app/lib/agents/topic-selector";
import { writeArticle } from "@/app/lib/agents/article-writer";
import { reviewArticle, reviseArticle } from "@/app/lib/agents/editor-review";
import { compileDailyDigest, persistDigest, sendDailyDigestEmail } from "@/app/lib/agents/digest-compiler";
import { createAdminClient } from "@/app/lib/supabase-server";
import type { ArticleDraft, EditorReview } from "@/app/lib/agents/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPipeline();
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPipeline();
}

async function runPipeline() {
  const startedAt = Date.now();
  const date = new Date().toISOString().split("T")[0];
  const errors: string[] = [];

  console.log(`[newsroom] Starting daily pipeline — ${date}`);

  // ── STEP 1 — Build context for all pillars in parallel ───────────────────────
  console.log("[newsroom] Step 1: Building context for all pillars…");
  const contexts = await Promise.all(
    JOURNALIST_PERSONAS.map((persona) =>
      buildDailyContext(persona.pillar).catch((err) => {
        const msg = `Context build failed for ${persona.pillar}: ${err.message}`;
        console.error(`[newsroom] ${msg}`);
        errors.push(msg);
        return {
          todayDate: date,
          recentArticleTitles: [],
          marketSnapshot: {},
          macroSnapshot: {},
          recentEarnings: [],
          trendingTopics: [],
        };
      })
    )
  );
  console.log("[newsroom] Step 1 complete.");

  // ── STEP 2 — Topic selection for all agents in parallel ──────────────────────
  console.log("[newsroom] Step 2: Selecting topics for all agents…");
  const agentTopics = await Promise.all(
    JOURNALIST_PERSONAS.map((persona, i) =>
      selectTopics(persona, contexts[i]).catch((err) => {
        const msg = `Topic selection failed for ${persona.name}: ${err.message}`;
        console.error(`[newsroom] ${msg}`);
        errors.push(msg);
        return [];
      })
    )
  );

  JOURNALIST_PERSONAS.forEach((persona, i) => {
    console.log(`[newsroom] ${persona.name} selected ${agentTopics[i].length} topic(s):`);
    agentTopics[i].forEach((t) => console.log(`  — ${t.title}`));
  });
  console.log("[newsroom] Step 2 complete.");

  // ── STEP 3 — Article writing (sequential per agent, parallel across agents) ──
  console.log("[newsroom] Step 3: Writing articles…");
  const allDrafts: ArticleDraft[] = [];

  const agentDraftResults = await Promise.all(
    JOURNALIST_PERSONAS.map(async (persona, i) => {
      const topics = agentTopics[i];
      if (topics.length === 0) return [];

      const drafts: ArticleDraft[] = [];
      for (const topic of topics) {
        try {
          console.log(`[newsroom] ${persona.name} writing: "${topic.title}"`);
          const draft = await writeArticle(persona, topic);
          drafts.push(draft);
          if (topics.indexOf(topic) < topics.length - 1) {
            await sleep(2000); // delay between articles for same agent
          }
        } catch (err) {
          const msg = `Write failed for ${persona.name} / "${topic.title}": ${(err as Error).message}`;
          console.error(`[newsroom] ${msg}`);
          errors.push(msg);
        }
      }

      // Delay between agents to manage rate limits
      if (i < JOURNALIST_PERSONAS.length - 1) {
        await sleep(3000);
      }

      return drafts;
    })
  );

  agentDraftResults.forEach((drafts) => allDrafts.push(...drafts));
  console.log(`[newsroom] Step 3 complete. ${allDrafts.length} article(s) written.`);

  // ── STEP 4 — Editor review (sequential) ─────────────────────────────────────
  console.log("[newsroom] Step 4: Editor review…");
  const reviewed: Array<{ draft: ArticleDraft; review: EditorReview }> = [];

  for (let i = 0; i < allDrafts.length; i++) {
    let draft = allDrafts[i];
    try {
      console.log(`[newsroom] Reviewing: "${draft.headline}"`);
      let review = await reviewArticle(draft, i);
      console.log(`[newsroom] Score: ${review.score}/10 — ${review.passed ? "PASSED" : "FAILED"}`);

      if (!review.passed) {
        console.log(`[newsroom] Requesting revision from ${draft.agentName}…`);
        const persona = JOURNALIST_PERSONAS.find((p) => p.pillar === draft.pillar)!;
        draft = await reviseArticle(persona, draft, review);
        review = await reviewArticle(draft, i);
        console.log(`[newsroom] Revised score: ${review.score}/10 — ${review.passed ? "PASSED" : "DROPPED"}`);
      }

      reviewed.push({ draft, review });
    } catch (err) {
      const msg = `Review failed for "${draft.headline}": ${(err as Error).message}`;
      console.error(`[newsroom] ${msg}`);
      errors.push(msg);
    }

    if (i < allDrafts.length - 1) {
      await sleep(1000);
    }
  }

  const passed = reviewed.filter((r) => r.review.passed).length;
  const failed = reviewed.filter((r) => !r.review.passed).length;
  console.log(`[newsroom] Step 4 complete. Passed: ${passed}, Failed: ${failed}`);

  // ── STEP 5 — Compile and send digest ────────────────────────────────────────
  console.log("[newsroom] Step 5: Compiling and sending digest…");
  const digest = compileDailyDigest(reviewed);

  try {
    await persistDigest(digest);
    console.log("[newsroom] Digest saved to Supabase.");
  } catch (err) {
    const msg = `Persist digest failed: ${(err as Error).message}`;
    console.error(`[newsroom] ${msg}`);
    errors.push(msg);
  }

  let digestSentAt: string | null = null;
  try {
    await sendDailyDigestEmail(digest);
    digestSentAt = new Date().toISOString();
    console.log("[newsroom] Digest email sent.");
  } catch (err) {
    const msg = `Email send failed: ${(err as Error).message}`;
    console.error(`[newsroom] ${msg}`);
    errors.push(msg);
  }

  // ── STEP 6 — Log run ─────────────────────────────────────────────────────────
  const totalDuration = Date.now() - startedAt;
  console.log(`[newsroom] Step 6: Logging run. Total duration: ${totalDuration}ms`);

  try {
    const supabase = createAdminClient();
    await supabase.from("newsroom_runs").insert({
      date,
      agents_triggered: JOURNALIST_PERSONAS.length,
      total_articles_written: allDrafts.length,
      passed_review: passed,
      failed_review: failed,
      digest_sent_at: digestSentAt,
      total_duration_ms: totalDuration,
      errors: errors,
    });
  } catch (err) {
    console.error("[newsroom] Failed to log run:", err);
  }

  console.log(`[newsroom] Pipeline complete — ${date}`);

  return NextResponse.json({
    date,
    agentsTriggered: JOURNALIST_PERSONAS.length,
    totalArticlesWritten: allDrafts.length,
    passedReview: passed,
    failedReview: failed,
    digestSentAt,
    totalDurationMs: totalDuration,
    errors,
  });
}
