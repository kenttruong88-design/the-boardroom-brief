import { NextResponse } from "next/server";
import { JOURNALIST_PERSONAS } from "@/app/lib/agents/personas";
import { buildDailyContext } from "@/app/lib/agents/context-builder";
import { selectTopics } from "@/app/lib/agents/topic-selector";
import { writeArticle } from "@/app/lib/agents/article-writer";
import { reviewArticle, reviseArticle } from "@/app/lib/agents/editor-review";
import { compileDailyDigest, persistDigest, sendDailyDigestEmail } from "@/app/lib/agents/digest-compiler";
import { createAdminClient } from "@/app/lib/supabase-server";
import {
  markJobRunning, markJobComplete, markJobFailed,
  updateJobProgress, appendJobLog, checkCancelled, logImageStatus,
} from "@/app/lib/pipeline-logger";
import type { ArticleDraft, EditorReview } from "@/app/lib/agents/types";

export const maxDuration = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPipeline(req, null);
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jobId = req.headers.get("x-job-id") ?? null;
  return runPipeline(req, jobId);
}

async function runPipeline(req: Request, jobId: string | null) {
  const startedAt = Date.now();
  const date = new Date().toISOString().split("T")[0];
  const errors: string[] = [];

  await markJobRunning(jobId);
  await appendJobLog(jobId, `Pipeline started — ${date}`);
  console.log(`[newsroom] Starting daily pipeline — ${date}`);

  // ── STAGE 1 — Build context ────────────────────────────────────────────────

  if (await checkCancelled(jobId)) {
    await appendJobLog(jobId, "[cancelled] Pipeline stopped before context stage");
    return NextResponse.json({ error: "Cancelled" });
  }

  await updateJobProgress(jobId, "context", {
    status: "running",
    detail: `Building context for ${JOURNALIST_PERSONAS.length} pillars`,
  });
  await appendJobLog(jobId, `Building daily context for ${JOURNALIST_PERSONAS.length} pillars…`);
  console.log("[newsroom] Step 1: Building context for all pillars…");

  const contexts = await Promise.all(
    JOURNALIST_PERSONAS.map((persona) =>
      buildDailyContext(persona.pillar).catch((err) => {
        const msg = `Context build failed for ${persona.pillar}: ${(err as Error).message}`;
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

  await updateJobProgress(jobId, "context", {
    status: "done",
    detail: `Context built for ${JOURNALIST_PERSONAS.length} pillars`,
  });
  await appendJobLog(jobId, "Context ready.");
  console.log("[newsroom] Step 1 complete.");

  // ── STAGE 2 — Topic selection ──────────────────────────────────────────────

  if (await checkCancelled(jobId)) {
    await appendJobLog(jobId, "[cancelled] Pipeline stopped before topic selection");
    await markJobFailed(jobId, "Cancelled by user", Date.now() - startedAt);
    return NextResponse.json({ error: "Cancelled" });
  }

  await updateJobProgress(jobId, "topics", {
    status: "running",
    detail: "Selecting stories for each journalist agent",
  });
  await appendJobLog(jobId, "Selecting topics for all agents…");
  console.log("[newsroom] Step 2: Selecting topics for all agents…");

  const agentTopics = await Promise.all(
    JOURNALIST_PERSONAS.map((persona, i) =>
      selectTopics(persona, contexts[i]).catch((err) => {
        const msg = `Topic selection failed for ${persona.name}: ${(err as Error).message}`;
        console.error(`[newsroom] ${msg}`);
        errors.push(msg);
        return [];
      })
    )
  );

  for (let i = 0; i < JOURNALIST_PERSONAS.length; i++) {
    const persona = JOURNALIST_PERSONAS[i];
    const count = agentTopics[i].length;
    await appendJobLog(jobId, `${persona.name} selected ${count} topic${count !== 1 ? "s" : ""}`);
    console.log(`[newsroom] ${persona.name} selected ${count} topic(s):`);
    agentTopics[i].forEach((t) => console.log(`  — ${t.title}`));
  }

  const totalTopics = agentTopics.reduce((sum, t) => sum + t.length, 0);
  await updateJobProgress(jobId, "topics", {
    status: "done",
    detail: `${totalTopics} topics selected across ${JOURNALIST_PERSONAS.length} agents`,
    counts: { total: totalTopics },
  });
  console.log("[newsroom] Step 2 complete.");

  // ── STAGE 3 — Article writing ──────────────────────────────────────────────

  if (await checkCancelled(jobId)) {
    await appendJobLog(jobId, "[cancelled] Pipeline stopped before article writing");
    await markJobFailed(jobId, "Cancelled by user", Date.now() - startedAt);
    return NextResponse.json({ error: "Cancelled" });
  }

  await updateJobProgress(jobId, "writing", {
    status: "running",
    detail: "Journalists writing their articles",
    counts: { written: 0, total: totalTopics },
  });
  await appendJobLog(jobId, `Writing ${totalTopics} article${totalTopics !== 1 ? "s" : ""}…`);
  console.log("[newsroom] Step 3: Writing articles…");

  const allDrafts: ArticleDraft[] = [];
  let writtenCount = 0;

  const agentDraftResults = await Promise.all(
    JOURNALIST_PERSONAS.map(async (persona, i) => {
      const topics = agentTopics[i];
      if (topics.length === 0) return [];

      const drafts: ArticleDraft[] = [];
      for (let ti = 0; ti < topics.length; ti++) {
        const topic = topics[ti];
        try {
          await appendJobLog(jobId, `${persona.name}: writing "${topic.title}"`);
          console.log(`[newsroom] ${persona.name} writing: "${topic.title}"`);
          const draft = await writeArticle(persona, topic);
          drafts.push(draft);
          writtenCount++;

          const articleSlug = draft.headline
            .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
          await logImageStatus(
            jobId,
            articleSlug,
            draft.featuredImage
              ? { source: draft.featuredImage.source, durationMs: draft.featuredImage.durationMs }
              : null
          );

          await updateJobProgress(jobId, "writing", {
            status: "running",
            counts: { written: writtenCount, total: totalTopics },
          });
          if (ti < topics.length - 1) await sleep(2000);
        } catch (err) {
          const msg = `Write failed for ${persona.name} / "${topic.title}": ${(err as Error).message}`;
          console.error(`[newsroom] ${msg}`);
          await appendJobLog(jobId, `ERROR: ${msg}`);
          errors.push(msg);
        }
      }
      if (i < JOURNALIST_PERSONAS.length - 1) await sleep(3000);
      return drafts;
    })
  );

  agentDraftResults.forEach((drafts) => allDrafts.push(...drafts));

  await updateJobProgress(jobId, "writing", {
    status: "done",
    detail: `${allDrafts.length} article${allDrafts.length !== 1 ? "s" : ""} written`,
    counts: { written: allDrafts.length, total: totalTopics },
  });
  await appendJobLog(jobId, `${allDrafts.length} articles written.`);
  console.log(`[newsroom] Step 3 complete. ${allDrafts.length} article(s) written.`);

  // ── STAGE 4 — Editor review ────────────────────────────────────────────────

  if (await checkCancelled(jobId)) {
    await appendJobLog(jobId, "[cancelled] Pipeline stopped before editor review");
    await markJobFailed(jobId, "Cancelled by user", Date.now() - startedAt);
    return NextResponse.json({ error: "Cancelled" });
  }

  await updateJobProgress(jobId, "review", {
    status: "running",
    detail: "Editor in chief reviewing each article",
    counts: { passed: 0, rejected: 0, total: allDrafts.length },
  });
  await appendJobLog(jobId, `Editor reviewing ${allDrafts.length} articles…`);
  console.log("[newsroom] Step 4: Editor review…");

  const reviewed: Array<{ draft: ArticleDraft; review: EditorReview }> = [];
  let passedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < allDrafts.length; i++) {
    let draft = allDrafts[i];
    try {
      console.log(`[newsroom] Reviewing: "${draft.headline}"`);
      let review = await reviewArticle(draft, i);
      const firstResult = review.passed ? "PASS" : "FAIL";
      await appendJobLog(
        jobId,
        `"${draft.headline.slice(0, 60)}" → ${review.score.toFixed(1)}/10 ${firstResult}`
      );
      console.log(`[newsroom] Score: ${review.score}/10 — ${firstResult}`);

      if (!review.passed) {
        await appendJobLog(jobId, `Requesting revision from ${draft.agentName}…`);
        console.log(`[newsroom] Requesting revision from ${draft.agentName}…`);
        const persona = JOURNALIST_PERSONAS.find((p) => p.pillar === draft.pillar)!;
        draft = await reviseArticle(persona, draft, review);
        review = await reviewArticle(draft, i);
        const reviseResult = review.passed ? "PASS" : "DROPPED";
        await appendJobLog(
          jobId,
          `Revised → ${review.score.toFixed(1)}/10 ${reviseResult}`
        );
        console.log(`[newsroom] Revised score: ${review.score}/10 — ${reviseResult}`);
      }

      reviewed.push({ draft, review });
      if (review.passed) passedCount++; else failedCount++;

      await updateJobProgress(jobId, "review", {
        status: "running",
        counts: { passed: passedCount, rejected: failedCount, total: allDrafts.length },
      });
    } catch (err) {
      const msg = `Review failed for "${draft.headline}": ${(err as Error).message}`;
      console.error(`[newsroom] ${msg}`);
      await appendJobLog(jobId, `ERROR: ${msg}`);
      errors.push(msg);
    }
    if (i < allDrafts.length - 1) await sleep(1000);
  }

  await updateJobProgress(jobId, "review", {
    status: "done",
    detail: `${passedCount} passed, ${failedCount} rejected`,
    counts: { passed: passedCount, rejected: failedCount },
  });
  await appendJobLog(jobId, `Review complete — ${passedCount} passed, ${failedCount} rejected.`);
  console.log(`[newsroom] Step 4 complete. Passed: ${passedCount}, Failed: ${failedCount}`);

  // ── STAGE 5 — Compile and send digest ─────────────────────────────────────

  if (await checkCancelled(jobId)) {
    await appendJobLog(jobId, "[cancelled] Pipeline stopped before digest");
    await markJobFailed(jobId, "Cancelled by user", Date.now() - startedAt);
    return NextResponse.json({ error: "Cancelled" });
  }

  await updateJobProgress(jobId, "digest", {
    status: "running",
    detail: "Saving digest and sending email",
  });
  await appendJobLog(jobId, "Compiling and sending daily digest…");
  console.log("[newsroom] Step 5: Compiling and sending digest…");

  const digest = compileDailyDigest(reviewed);

  try {
    await persistDigest(digest);
    await appendJobLog(jobId, "Digest saved to Supabase.");
    console.log("[newsroom] Digest saved to Supabase.");
  } catch (err) {
    const msg = `Persist digest failed: ${(err as Error).message}`;
    console.error(`[newsroom] ${msg}`);
    await appendJobLog(jobId, `ERROR: ${msg}`);
    errors.push(msg);
  }

  let digestSentAt: string | null = null;
  try {
    await sendDailyDigestEmail(digest);
    digestSentAt = new Date().toISOString();
    await appendJobLog(jobId, "Digest email sent.");
    console.log("[newsroom] Digest email sent.");
  } catch (err) {
    const msg = `Email send failed: ${(err as Error).message}`;
    console.error(`[newsroom] ${msg}`);
    await appendJobLog(jobId, `WARNING: ${msg}`);
    errors.push(msg);
  }

  await updateJobProgress(jobId, "digest", {
    status: "done",
    detail: digestSentAt ? "Email sent" : "Saved (email failed)",
  });

  // ── Log run to newsroom_runs ───────────────────────────────────────────────
  const totalDuration = Date.now() - startedAt;
  console.log(`[newsroom] Step 6: Logging run. Total duration: ${totalDuration}ms`);

  try {
    const supabase = createAdminClient();
    await supabase.from("newsroom_runs").insert({
      date,
      agents_triggered: JOURNALIST_PERSONAS.length,
      total_articles_written: allDrafts.length,
      passed_review: passedCount,
      failed_review: failedCount,
      digest_sent_at: digestSentAt,
      total_duration_ms: totalDuration,
      errors,
    });
  } catch (err) {
    console.error("[newsroom] Failed to log run:", err);
  }

  // ── Mark job complete ──────────────────────────────────────────────────────
  await appendJobLog(
    jobId,
    `Pipeline complete in ${Math.round(totalDuration / 1000)}s — ${allDrafts.length} written, ${passedCount} passed.`
  );
  await markJobComplete(
    jobId,
    {
      articles_written:  allDrafts.length,
      articles_passed:   passedCount,
      articles_rejected: failedCount,
    },
    totalDuration
  );

  console.log(`[newsroom] Pipeline complete — ${date}`);

  return NextResponse.json({
    date,
    agentsTriggered:      JOURNALIST_PERSONAS.length,
    totalArticlesWritten: allDrafts.length,
    passedReview:         passedCount,
    failedReview:         failedCount,
    digestSentAt,
    totalDurationMs:      totalDuration,
    errors,
  });
}
