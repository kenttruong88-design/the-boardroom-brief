"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, X, Clock } from "lucide-react";
import type { ArticleDraft, EditorReview } from "@/app/lib/agents/types";

interface RejectedEntry {
  draft: ArticleDraft;
  review: EditorReview;
  articleIndex: number;
}

interface Props {
  rejectedArticles: Array<{ draft: ArticleDraft; review: EditorReview; articleIndex: number }>;
  onDismiss?: (articleIndex: number) => void;
}

function truncate(text: string, max: number) {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

function ScoreDot({ score }: { score: number }) {
  const color = score >= 7 ? "#15803d" : score >= 5 ? "#d97706" : "#dc2626";
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

function RejectedRow({
  entry,
  onDismiss,
}: {
  entry: RejectedEntry;
  onDismiss?: (i: number) => void;
}) {
  const { draft, review, articleIndex } = entry;
  const [revisionState, setRevisionState] = useState<
    "idle" | "loading" | "pending" | "error"
  >("idle");
  const [revisedScore, setRevisedScore] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (dismissed) return null;

  async function handleRevise() {
    setRevisionState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/editorial/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIndex }),
      });
      const data = await res.json() as { score?: number; error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Revision failed.");
        setRevisionState("error");
      } else {
        setRevisedScore(data.score ?? null);
        setRevisionState("pending");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setRevisionState("error");
    }
  }

  async function handleDismiss() {
    try {
      await fetch("/api/editorial/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", articleIndex }),
      });
    } catch {
      // non-fatal — still remove from UI
    }
    setDismissed(true);
    onDismiss?.(articleIndex);
  }

  return (
    <div
      className="flex items-start gap-3 py-3 px-4"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Status dot */}
      <ScoreDot score={review.score} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-xs font-mono font-semibold" style={{ color: "var(--ink-m)" }}>
            {draft.agentName}
          </span>
          <span className="text-xs font-sans font-medium" style={{ color: "var(--navy)" }}>
            {truncate(draft.headline, 80)}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-xs font-mono font-bold"
            style={{ color: "#dc2626" }}
          >
            {review.score}/10
          </span>
          <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>
            {truncate(review.notes, 120)}
          </span>
        </div>

        {revisionState === "pending" && (
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="w-3 h-3" style={{ color: "var(--ink-m)" }} />
            <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>
              Revised — pending
            </span>
            {revisedScore !== null && (
              <span
                className="text-xs font-mono font-bold ml-1"
                style={{ color: revisedScore >= 7 ? "#15803d" : "#dc2626" }}
              >
                New score: {revisedScore}/10
              </span>
            )}
          </div>
        )}

        {revisionState === "error" && (
          <p className="text-xs font-sans mt-1" style={{ color: "#dc2626" }}>
            {errorMsg}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {revisionState === "idle" || revisionState === "error" ? (
          <button
            onClick={handleRevise}
            disabled={revisionState === "loading"}
            className="flex items-center gap-1 text-xs font-sans px-2.5 py-1.5 transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{
              border: "1px solid var(--border)",
              color: "var(--navy)",
              borderRadius: "2px",
              whiteSpace: "nowrap",
            }}
            title="Send for one more revision attempt"
          >
            <RefreshCw className="w-3 h-3" />
            Send for revision
          </button>
        ) : revisionState === "loading" ? (
          <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>
            Revising…
          </span>
        ) : null}

        <button
          onClick={handleDismiss}
          className="flex items-center gap-1 text-xs font-sans px-2.5 py-1.5 transition-opacity hover:opacity-70"
          style={{ color: "#dc2626" }}
          title="Permanently dismiss this article"
        >
          <X className="w-3 h-3" />
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default function RejectedArticlesSection({ rejectedArticles, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (rejectedArticles.length === 0) return null;

  return (
    <div style={{ border: "1px solid var(--border)" }}>
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:opacity-70"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: "#dc2626" }}
          />
          <span className="text-sm font-sans font-medium" style={{ color: "var(--navy)" }}>
            Rejected by editor in chief ({rejectedArticles.length}) — not sent for human review
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ink-m)" }} />
        ) : (
          <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ink-m)" }} />
        )}
      </button>

      {/* Rows */}
      {expanded && (
        <div>
          {rejectedArticles.map((entry) => (
            <RejectedRow
              key={entry.articleIndex}
              entry={entry}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}
