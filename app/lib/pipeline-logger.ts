import { createAdminClient } from "@/app/lib/supabase-server";

// ── Types ─────────────────────────────────────────────────────────────────────

export type StageKey = "context" | "topics" | "writing" | "review" | "digest";
export type StageStatus = "pending" | "running" | "done" | "error";

export interface StageUpdate {
  status: StageStatus;
  detail?: string;
  counts?: Record<string, number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hhmm(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

// ── Stage progress ────────────────────────────────────────────────────────────

/** Merges a stage update into pipeline_jobs.progress. Non-fatal. */
export async function updateJobProgress(
  jobId: string | null,
  stage: StageKey,
  update: StageUpdate
): Promise<void> {
  if (!jobId) return;
  const supabase = createAdminClient();
  try {
    const { data: row } = await supabase
      .from("pipeline_jobs")
      .select("progress")
      .eq("id", jobId)
      .single();

    const prev = (row?.progress as Record<string, unknown>) ?? {};
    const existing = (prev[stage] as Record<string, unknown>) ?? {};

    prev[stage] = {
      ...existing,
      status:  update.status,
      ...(update.detail  ? { detail:  update.detail }  : {}),
      ...(update.counts  ? { counts:  update.counts }  : {}),
      ...(update.status === "done" || update.status === "error"
        ? { completedAt: new Date().toISOString() }
        : {}),
    };

    await supabase
      .from("pipeline_jobs")
      .update({ progress: prev })
      .eq("id", jobId);
  } catch (err) {
    console.error("[pipeline-logger] updateJobProgress failed:", (err as Error).message);
  }
}

// ── Log lines ─────────────────────────────────────────────────────────────────

/** Appends a timestamped line to pipeline_jobs.log. Non-fatal. */
export async function appendJobLog(
  jobId: string | null,
  message: string
): Promise<void> {
  if (!jobId) return;
  const supabase = createAdminClient();
  const line = `[${hhmm()}] ${message}`;
  try {
    const { data: row } = await supabase
      .from("pipeline_jobs")
      .select("log")
      .eq("id", jobId)
      .single();

    const log = [...((row?.log as string[]) ?? []), line];
    await supabase
      .from("pipeline_jobs")
      .update({ log })
      .eq("id", jobId);
  } catch (err) {
    console.error("[pipeline-logger] appendJobLog failed:", (err as Error).message);
  }
}

// ── Lifecycle helpers ─────────────────────────────────────────────────────────

export async function markJobRunning(jobId: string | null): Promise<void> {
  if (!jobId) return;
  try {
    await createAdminClient()
      .from("pipeline_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);
  } catch (e) {
    console.error("[pipeline-logger] markJobRunning:", (e as Error).message);
  }
}

export async function markJobComplete(
  jobId: string | null,
  counts: { articles_written: number; articles_passed: number; articles_rejected: number },
  durationMs: number
): Promise<void> {
  if (!jobId) return;
  try {
    await createAdminClient()
      .from("pipeline_jobs")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        ...counts,
      })
      .eq("id", jobId);
  } catch (e) {
    console.error("[pipeline-logger] markJobComplete:", (e as Error).message);
  }
}

export async function markJobFailed(
  jobId: string | null,
  error: string,
  durationMs: number
): Promise<void> {
  if (!jobId) return;
  try {
    await createAdminClient()
      .from("pipeline_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        error,
      })
      .eq("id", jobId);
  } catch (e) {
    console.error("[pipeline-logger] markJobFailed:", (e as Error).message);
  }
}

// ── Image generation status ───────────────────────────────────────────────────

export async function logImageStatus(
  jobId: string | null,
  articleSlug: string,
  result: { source: string; durationMs: number } | null
): Promise<void> {
  if (!jobId) return;
  let message: string;
  if (result) {
    const secs = (result.durationMs / 1000).toFixed(1);
    if (result.source === "pexels") {
      message = `Image: ${articleSlug} — flux failed, using Pexels fallback (${secs}s)`;
    } else if (result.source === "pillar-default") {
      message = `Image: ${articleSlug} — using pillar default image`;
    } else {
      message = `Image: ${articleSlug} — generated via ${result.source} (${secs}s)`;
    }
  } else {
    message = `Image: ${articleSlug} — all sources failed, publishing without image`;
  }
  await appendJobLog(jobId, message);
}

// ── Cancellation check ────────────────────────────────────────────────────────

/** Returns true if the job has been cancelled by the user. */
export async function checkCancelled(jobId: string | null): Promise<boolean> {
  if (!jobId) return false;
  try {
    const { data } = await createAdminClient()
      .from("pipeline_jobs")
      .select("status")
      .eq("id", jobId)
      .single();
    return data?.status === "cancelled";
  } catch {
    return false;
  }
}
