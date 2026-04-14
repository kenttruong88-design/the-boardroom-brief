import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { requireAuth } from "@/app/api/editorial/_helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { jobId } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("pipeline_jobs")
    .select(
      "id, status, progress, log, started_at, completed_at, duration_ms, " +
      "articles_written, articles_passed, articles_rejected, error, created_at"
    )
    .eq("id", jobId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    jobId:            data.id,
    status:           data.status,
    progress:         data.progress,
    log:              data.log,
    startedAt:        data.started_at,
    completedAt:      data.completed_at,
    durationMs:       data.duration_ms,
    articlesWritten:  data.articles_written,
    articlesPassed:   data.articles_passed,
    articlesRejected: data.articles_rejected,
    error:            data.error,
  });
}
