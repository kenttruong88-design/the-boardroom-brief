import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { requireAuth, loadDigest, todayDate } from "../_helpers";

// GET — returns today's digest + last pipeline run info (auth required)
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();

  // Today's digest
  const row = await loadDigest();

  // Last successful newsroom_run (for the "Last run" indicator)
  const { data: lastRun } = await supabase
    .from("newsroom_runs")
    .select("date, total_articles_written, passed_review, ran_at, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({
      status: "pending",
      message: "Pipeline not yet run today",
      lastRun: lastRun ?? null,
    });
  }

  return NextResponse.json({
    status: "ready",
    date: todayDate(),
    digest: row.digest_json,
    articlesApproved: row.articles_approved,
    articlesRejected: row.articles_rejected,
    pipelineRanAt: row.created_at,
    lastRun: lastRun ?? null,
  });
}
