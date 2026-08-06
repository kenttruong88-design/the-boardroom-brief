"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase";
import {
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Film,
} from "lucide-react";
import type { UgcVideoQueueRow, UgcClip } from "@/app/lib/social/ugc-video-generator";

const STATUS_LABEL: Record<UgcVideoQueueRow["status"], string> = {
  pending_approval: "Pending approval",
  rejected: "Rejected",
  approved: "Approved",
  generating: "Generating",
  complete: "Complete",
  failed: "Failed",
};

const STATUS_COLOR: Record<UgcVideoQueueRow["status"], string> = {
  pending_approval: "#b8960c",
  rejected: "#7f1d1d",
  approved: "#2563eb",
  generating: "#2563eb",
  complete: "#16a34a",
  failed: "var(--red)",
};

function StatusBadge({ status }: { status: UgcVideoQueueRow["status"] }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--font-jetbrains)",
        fontSize: "0.6rem",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "3px 8px",
        border: `1px solid ${color}44`,
        background: `${color}15`,
        color,
        fontWeight: 600,
      }}
    >
      {(status === "generating" || status === "approved") && (
        <Loader2 className="w-3 h-3 animate-spin" />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

function ClipRow({ clip }: { clip: UgcClip }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        marginBottom: 6,
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <span
          style={{
            fontFamily: "var(--font-jetbrains)",
            fontSize: "0.6rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--navy)",
            fontWeight: 700,
          }}
        >
          {clip.label.replace(/_/g, " ")}
        </span>
        <span
          style={{
            fontFamily: "var(--font-jetbrains)",
            fontSize: "0.6rem",
            color: clip.status === "failed" ? "var(--red)" : clip.status === "complete" ? "#16a34a" : "var(--ink-m)",
          }}
        >
          {clip.status}{clip.error ? ` — ${clip.error}` : ""}
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: "0.8rem",
          color: "var(--ink)",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {clip.script}
      </p>
      {clip.status === "complete" && clip.video_url && (
        <video
          controls
          preload="metadata"
          src={clip.video_url}
          style={{ width: 160, marginTop: 8, background: "#000" }}
        />
      )}
    </div>
  );
}

export default function UgcVideoQueuePage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login?next=/editorial/ugc");
    });
  }, [router]);

  const [videos, setVideos] = useState<UgcVideoQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/editorial/ugc/list");
      const data = (await res.json()) as { videos?: UgcVideoQueueRow[]; error?: string };
      if (data.error) {
        setFetchError(data.error);
        setVideos([]);
      } else {
        setFetchError(null);
        setVideos(data.videos ?? []);
      }
    } catch (err) {
      setFetchError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  async function handleApprove(id: string, action: "approve" | "reject") {
    setActionLoading((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch("/api/editorial/ugc/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueId: id, action }),
      });
      const data = (await res.json()) as { video?: UgcVideoQueueRow; error?: string };
      if (data.video) {
        setVideos((prev) => prev.map((v) => (v.id === id ? data.video! : v)));
      }
    } finally {
      setActionLoading((p) => ({ ...p, [id]: false }));
    }
  }

  async function handleRefresh(id: string) {
    setActionLoading((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/editorial/ugc/status?queueId=${id}`);
      const data = (await res.json()) as { video?: UgcVideoQueueRow; error?: string };
      if (data.video) {
        setVideos((prev) => prev.map((v) => (v.id === id ? data.video! : v)));
      }
    } finally {
      setActionLoading((p) => ({ ...p, [id]: false }));
    }
  }

  const counts = videos.reduce(
    (acc, v) => {
      acc[v.status] = (acc[v.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <div className="container-editorial py-8">
        <div className="mb-6">
          <button
            onClick={() => router.push("/editorial")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-m)",
              fontFamily: "var(--font-jetbrains)",
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              padding: 0,
              marginBottom: 8,
            }}
          >
            ← Editorial
          </button>
          <div className="flex items-center justify-between">
            <h1
              className="font-serif font-bold"
              style={{ fontSize: "1.75rem", color: "var(--navy)" }}
            >
              UGC Video Queue
            </h1>
            <button
              onClick={fetchVideos}
              disabled={loading}
              className="flex items-center gap-2"
              style={{
                fontFamily: "var(--font-jetbrains)",
                fontSize: "0.65rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--ink-m)",
                background: "none",
                border: "1px solid var(--border)",
                padding: "6px 12px",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.8rem", color: "var(--ink-m)", marginTop: 4 }}>
            Suki / Out of Office avatar videos, drafted via <code>scripts/ugc-draft.mts</code>. Approve to spend Hedra credits; refresh to poll generation status.
          </p>
        </div>

        <div className="rule-thick mb-6" />

        {fetchError && (
          <div
            style={{
              padding: "12px 16px",
              background: "#7f1d1d15",
              border: "1px solid #7f1d1d44",
              color: "#7f1d1d",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.8rem",
              marginBottom: 16,
            }}
          >
            Couldn't load the queue: {fetchError}
            {fetchError.includes("schema cache") && (
              <> — run <code>supabase/migrations/021_ugc_video_queue.sql</code> and{" "}
                <code>022_ugc_video_queue_compiled_url.sql</code> in the Supabase SQL editor.</>
            )}
          </div>
        )}
        {loading && videos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--ink-m)" }}>
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3" style={{ color: "var(--navy)" }} />
          </div>
        ) : videos.length === 0 && !fetchError ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 0",
              color: "var(--ink-m)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.875rem",
              fontStyle: "italic",
            }}
          >
            No UGC videos queued yet. Run <code>npx tsx scripts/ugc-draft.mts &lt;path-to-out-of-office-md&gt;</code> to draft one.
          </div>
        ) : (
          <div className="space-y-3">
            {videos.map((video) => {
              const isExpanded = !!expanded[video.id];
              const isActing = !!actionLoading[video.id];
              return (
                <div
                  key={video.id}
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "16px 20px" }}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => setExpanded((p) => ({ ...p, [video.id]: !p[video.id] }))}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" style={{ color: "var(--navy)" }} />
                          ) : (
                            <ChevronRight className="w-4 h-4" style={{ color: "var(--navy)" }} />
                          )}
                        </button>
                        <span
                          style={{
                            fontFamily: "var(--font-dm-sans)",
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            color: "var(--navy)",
                          }}
                        >
                          {video.article_headline}
                        </span>
                      </div>
                      <div className="flex items-center gap-3" style={{ paddingLeft: 22 }}>
                        <a
                          href={video.article_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                          style={{
                            fontFamily: "var(--font-jetbrains)",
                            fontSize: "0.6rem",
                            color: "var(--ink-m)",
                            textDecoration: "none",
                          }}
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {video.persona_name}
                        </a>
                        <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: "0.6rem", color: "var(--ink-m)" }}>
                          {new Date(video.created_at).toLocaleString("en-GB", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={video.status} />
                  </div>

                  {/* Preview: compiled video if complete */}
                  {video.status === "complete" && video.compiled_video_url && (
                    <div style={{ paddingLeft: 22, marginTop: 10, marginBottom: 10 }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Film className="w-3.5 h-3.5" style={{ color: "var(--navy)" }} />
                        <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: "0.6rem", color: "var(--ink-m)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Compiled preview (hard-cut, uncaptioned)
                        </span>
                      </div>
                      <video
                        controls
                        preload="metadata"
                        src={video.compiled_video_url}
                        style={{ width: 220, background: "#000" }}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2" style={{ paddingLeft: 22 }}>
                    {video.status === "pending_approval" && (
                      <>
                        <button
                          onClick={() => handleApprove(video.id, "approve")}
                          disabled={isActing}
                          className="flex items-center gap-1.5"
                          style={{
                            padding: "6px 14px", background: "#16a34a", color: "#fff", border: "none",
                            cursor: isActing ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)",
                            fontSize: "0.78rem", fontWeight: 600, opacity: isActing ? 0.6 : 1,
                          }}
                        >
                          {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Approve (spends Hedra credits)
                        </button>
                        <button
                          onClick={() => handleApprove(video.id, "reject")}
                          disabled={isActing}
                          className="flex items-center gap-1.5"
                          style={{
                            padding: "6px 14px", background: "var(--red)", color: "#fff", border: "none",
                            cursor: isActing ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)",
                            fontSize: "0.78rem", fontWeight: 600, opacity: isActing ? 0.6 : 1,
                          }}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    )}
                    {(video.status === "approved" || video.status === "generating") && (
                      <button
                        onClick={() => handleRefresh(video.id)}
                        disabled={isActing}
                        className="flex items-center gap-1.5"
                        style={{
                          padding: "6px 14px", background: "var(--navy)", color: "var(--cream)", border: "none",
                          cursor: isActing ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)",
                          fontSize: "0.78rem", fontWeight: 600, opacity: isActing ? 0.6 : 1,
                        }}
                      >
                        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Check status
                      </button>
                    )}
                  </div>

                  {/* Expanded: per-clip detail */}
                  {isExpanded && (
                    <div style={{ paddingLeft: 22, marginTop: 12 }}>
                      {video.clips.map((clip) => (
                        <ClipRow key={clip.label} clip={clip} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Status summary */}
        {videos.length > 0 && (
          <p style={{ fontFamily: "var(--font-jetbrains)", fontSize: "0.6rem", color: "var(--ink-m)", marginTop: 16 }}>
            {Object.entries(counts).map(([status, n]) => `${STATUS_LABEL[status as UgcVideoQueueRow["status"]]}: ${n}`).join("  ·  ")}
          </p>
        )}
      </div>
    </div>
  );
}
