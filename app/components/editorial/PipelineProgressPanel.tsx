"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, CheckCircle, XCircle, Clock, X, ArrowRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "pending" | "running" | "complete" | "failed" | "cancelled";
type StageStatus = "pending" | "running" | "done" | "error";

interface StageProgress {
  status?: StageStatus;
  detail?: string;
  counts?: Record<string, number>;
  completedAt?: string;
}

interface JobData {
  jobId: string;
  status: JobStatus;
  progress: Record<string, StageProgress>;
  log: string[];
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  articlesWritten: number;
  articlesPassed: number;
  articlesRejected: number;
  error: string | null;
}

interface Props {
  jobId: string;
  onClose: () => void;
  onComplete: () => void;
}

// ── Stage definitions ─────────────────────────────────────────────────────────

const STAGES: Array<{ key: string; label: string }> = [
  { key: "context", label: "Building context" },
  { key: "topics",  label: "Topic selection" },
  { key: "writing", label: "Writing articles" },
  { key: "review",  label: "Editor review" },
  { key: "digest",  label: "Compiling digest" },
];

// ── Stage icon ────────────────────────────────────────────────────────────────

function StageIcon({ status }: { status: StageStatus | undefined }) {
  if (!status || status === "pending") {
    return (
      <span
        className="flex-shrink-0 w-4 h-4 rounded-full border-2"
        style={{ borderColor: "var(--border)" }}
      />
    );
  }
  if (status === "running") {
    return <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: "#1d4ed8" }} />;
  }
  if (status === "done") {
    return <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#15803d" }} />;
  }
  return <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#c8391a" }} />;
}

// ── Elapsed timer ─────────────────────────────────────────────────────────────

function ElapsedTimer({ startedAt, completedAt }: { startedAt: string | null; completedAt: string | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    if (completedAt) {
      setElapsed(Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000));
      return;
    }
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, completedAt]);

  if (!startedAt || elapsed === 0) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const label = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <span className="text-xs font-mono" style={{ color: "var(--ink-m)" }}>
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PipelineProgressPanel({ jobId, onClose, onComplete }: Props) {
  const [job, setJob] = useState<JobData | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Polling ───────────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/newsroom/status/${jobId}`);
      if (!res.ok) return;
      const data = await res.json() as JobData;
      setJob(data);

      // Auto-close panel 5s after completion
      if (data.status === "complete" && !completionTimer.current) {
        completionTimer.current = setTimeout(() => {
          onComplete();
        }, 5000);
      }
    } catch {
      // non-fatal — keep polling
    }
  }, [jobId, onComplete]);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 10_000);
    return () => {
      clearInterval(id);
      if (completionTimer.current) clearTimeout(completionTimer.current);
    };
  }, [fetchStatus]);

  // ── Auto-scroll log ───────────────────────────────────────────────────────

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [job?.log]);

  // ── Cancel ────────────────────────────────────────────────────────────────

  async function handleCancel() {
    setCancelling(true);
    try {
      await fetch(`/api/newsroom/cancel/${jobId}`, { method: "POST" });
      await fetchStatus();
    } finally {
      setCancelling(false);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const status = job?.status ?? "pending";
  const isActive = status === "pending" || status === "running";
  const isTerminal = status === "complete" || status === "failed" || status === "cancelled";

  const completedStages = STAGES.filter((s) => {
    const st = job?.progress?.[s.key]?.status;
    return st === "done" || st === "error";
  }).length;
  const progressPct = Math.round((completedStages / STAGES.length) * 100);

  const startTime = job?.startedAt
    ? new Date(job.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
    : null;

  // ── Status label ──────────────────────────────────────────────────────────

  const statusLabel =
    status === "pending"   ? "Starting up…" :
    status === "running"   ? "Pipeline running" :
    status === "complete"  ? "Complete" :
    status === "failed"    ? "Failed" :
    status === "cancelled" ? "Cancelled" : "";

  const statusColor =
    status === "complete"  ? "#15803d" :
    status === "failed"    ? "#c8391a" :
    status === "cancelled" ? "var(--ink-m)" :
    "var(--navy)";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${isActive ? "#1d4ed8" : status === "complete" ? "#15803d" : "#c8391a"}`,
        background: "var(--surface)",
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between gap-4 px-5 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isActive && (
            <span className="relative flex-shrink-0 w-2.5 h-2.5">
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: "#1d4ed8", opacity: 0.5 }}
              />
              <span className="relative w-2.5 h-2.5 rounded-full block" style={{ background: "#1d4ed8" }} />
            </span>
          )}
          {status === "complete" && (
            <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#15803d" }} />
          )}
          {(status === "failed" || status === "cancelled") && (
            <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#c8391a" }} />
          )}

          <div>
            <span className="text-sm font-sans font-semibold" style={{ color: statusColor }}>
              {statusLabel}
            </span>
            {startTime && (
              <span className="text-xs font-sans ml-2" style={{ color: "var(--ink-m)" }}>
                · triggered manually · started {startTime} UTC
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <ElapsedTimer startedAt={job?.startedAt ?? null} completedAt={job?.completedAt ?? null} />

          {status === "complete" && (
            <button
              onClick={() => { onComplete(); }}
              className="flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-1.5 transition-opacity hover:opacity-80"
              style={{ background: "#15803d", color: "#fff", borderRadius: "2px" }}
            >
              View digest <ArrowRight className="w-3 h-3" />
            </button>
          )}

          {isActive && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs font-sans px-3 py-1.5 transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ border: "1px solid var(--border)", color: "var(--red)", borderRadius: "2px" }}
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}

          <button onClick={onClose} className="transition-opacity hover:opacity-60 ml-1">
            <X className="w-4 h-4" style={{ color: "var(--ink-m)" }} />
          </button>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="h-1 w-full" style={{ background: "var(--border)" }}>
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${status === "complete" ? 100 : progressPct}%`,
            background: status === "failed" ? "#c8391a" : "#1d4ed8",
          }}
        />
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── Left: stages ── */}
        <div className="space-y-3">
          {STAGES.map((stage) => {
            const sp = job?.progress?.[stage.key];
            const st = sp?.status ?? "pending";

            return (
              <div key={stage.key} className="flex items-start gap-2.5">
                <StageIcon status={st} />
                <div className="min-w-0">
                  <div
                    className="text-xs font-sans font-medium"
                    style={{ color: st === "pending" ? "var(--ink-m)" : "var(--navy)" }}
                  >
                    {stage.label}
                    {sp?.counts && st === "running" && (
                      <span className="font-normal ml-1.5" style={{ color: "var(--ink-m)" }}>
                        {Object.entries(sp.counts)
                          .map(([k, v]) => `${v} ${k}`)
                          .join(" · ")}
                      </span>
                    )}
                  </div>
                  {sp?.detail && (
                    <p className="text-xs font-sans mt-0.5" style={{ color: "var(--ink-m)" }}>
                      {sp.detail}
                    </p>
                  )}
                  {sp?.completedAt && st === "done" && (
                    <p className="text-2xs font-mono mt-0.5" style={{ color: "var(--ink-m)", opacity: 0.6 }}>
                      <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                      {new Date(sp.completedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Terminal summary */}
          {isTerminal && job && (
            <div
              className="mt-4 pt-4 text-xs font-sans space-y-1"
              style={{ borderTop: "1px solid var(--border)", color: "var(--ink-m)" }}
            >
              {status === "complete" && (
                <>
                  <p><strong style={{ color: "var(--navy)" }}>{job.articlesWritten}</strong> articles written</p>
                  <p><strong style={{ color: "#15803d" }}>{job.articlesPassed}</strong> passed editor review</p>
                  <p><strong style={{ color: "#c8391a" }}>{job.articlesRejected}</strong> rejected</p>
                </>
              )}
              {status === "failed" && job.error && (
                <p style={{ color: "#c8391a" }}>{job.error}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Right: log ── */}
        <div>
          <p className="text-2xs font-sans font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-m)" }}>
            Log
          </p>
          <div
            ref={logRef}
            className="font-mono text-xs leading-relaxed overflow-y-auto"
            style={{
              height: "180px",
              background: "var(--navy)",
              color: "rgba(245,240,232,0.75)",
              padding: "10px 12px",
              borderRadius: "2px",
            }}
          >
            {!job?.log?.length ? (
              <span style={{ opacity: 0.4 }}>Waiting for pipeline to start…</span>
            ) : (
              job.log.slice(-20).map((line, i) => (
                <div key={i} style={{ color: line.includes("ERROR") ? "#fca5a5" : line.includes("WARNING") ? "#fcd34d" : line.includes("cancelled") ? "#d1d5db" : "rgba(245,240,232,0.75)" }}>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
