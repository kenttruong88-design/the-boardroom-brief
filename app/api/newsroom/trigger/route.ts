import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { requireAuth, todayDate } from "@/app/api/editorial/_helpers";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({})) as { force?: boolean };
  const supabase = createAdminClient();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // ── Guard 1: already running ──────────────────────────────────────────────
  const { data: runningJob } = await supabase
    .from("pipeline_jobs")
    .select("id")
    .eq("status", "running")
    .gte("created_at", twoHoursAgo)
    .limit(1)
    .maybeSingle();

  if (runningJob) {
    return NextResponse.json({
      error: "Pipeline already running",
      jobId: runningJob.id,
      status: "already_running",
    });
  }

  // ── Guard 2: already ran today ────────────────────────────────────────────
  if (!body.force) {
    const { data: existingDigest } = await supabase
      .from("daily_digest")
      .select("date, digest_json")
      .eq("date", todayDate())
      .maybeSingle();

    if (existingDigest) {
      const digest = existingDigest.digest_json as { totalArticles?: number };
      return NextResponse.json({
        error: "Pipeline already ran today",
        message: "Pass force:true to run again",
        articlesProduced: digest.totalArticles ?? 0,
        status: "already_ran",
      });
    }
  }

  // ── Create job ────────────────────────────────────────────────────────────
  const { data: job, error: jobError } = await supabase
    .from("pipeline_jobs")
    .insert({ triggered_by: "manual", status: "pending" })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Failed to create pipeline job" }, { status: 500 });
  }

  const jobId: string = job.id;

  // ── Kick off pipeline in background (Next.js 15+ after()) ─────────────────
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;

  after(async () => {
    await fetch(`${base}/api/newsroom/run`, {
      method: "POST",
      headers: {
        "x-cron-secret": process.env.CRON_SECRET ?? "",
        "x-job-id": jobId,
      },
    }).catch(async (err) => {
      console.error("[trigger] Background pipeline request failed:", err);
      // Mark job failed if we couldn't even start it
      await supabase
        .from("pipeline_jobs")
        .update({ status: "failed", error: (err as Error).message })
        .eq("id", jobId)
        .catch(() => {});
    });
  });

  return NextResponse.json({ jobId, status: "started" });
}
