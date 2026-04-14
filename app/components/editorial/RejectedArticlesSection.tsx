"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, X, Clock } from "lucide-react";
import type { ArticleDraft, EditorReview } from "@/app/lib/agents/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RejectedArticleEntry {
  draft: ArticleDraft;
  review: EditorReview;
  articleIndex: number;
}

interface Props {
  rejectedArticles: RejectedArticleEntry[];
  onDismiss?: (articleIndex: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(text: string, max: number) {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

// ── Row ───────────────────────────────────────────────────────────────────────

type RevisionState = "idle" | "loading" | "done" | "error";

function RejectedRow({
  entry,
  onDismiss,
}: {
  entry: RejectedArticleEntry;
  onDismiss?: (i: number) => void;
}) {
  const { draft, review, articleIndex } = entry;

  const [revisionState, setRevisionState] = useState<RevisionState>("idle");
  const [revisedScore, setRevisedScore]   = useState<number | null>(null);
  const [revisedNotes, setRevisedNotes]   = useState<string>("");
  const [errorMsg, setErrorMsg]           = useState("");
  const [dismissed, setDismissed]         = useState(false);

  if (dismissed) return null;

  async function handleRevise() {
    setRevisionState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/editorial/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: String(articleIndex) }),
      });
      const data = await res.json() as {
        success?: boolean;
        newScore?: number;
        passed?: boolean;
        notes?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? "Revision failed. Please try again.");
        setRevisionState("error");
      } else {
        setRevisedScore(data.newScore ?? null);
        setRevisedNotes(data.notes ?? "");
        setRevisionState("done");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setRevisionState("error");
    }
  }

  async function handleDismiss() {
    try {
      await fetch("/api/editorial/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: String(articleIndex) }),
      });
    } catch {
      // non-fatal — still remove from UI
    }
    setDismissed(true);
    onDismiss?.(articleIndex);
  }

  return (
    <div
      className="flex items-start gap-3 px-4 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Red status dot */}
      <span
        className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full"
        style={{ background: "#dc2626" }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Agent + headline */}
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span
            className="text-xs font-mono font-semibold flex-shrink-0"
            style={{ color: "var(--ink-m)" }}
          >
            {draft.agentName}
          </span>
          <span
            className="text-xs font-sans"
            style={{ color: "var(--navy)" }}
          >
            {truncate(draft.headline, 80)}
          </span>
        </div>

        {/* Score + notes */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className="text-xs font-mono font-bold flex-shrink-0"
            style={{ color: "#dc2626" }}
          >
            {review.score.toFixed(1)}/10
          </span>
          <span
            className="text-xs font-sans"
            style={{ color: "var(--ink-m)" }}
          >
            {truncate(review.notes, 120)}
          </span>
        </div>

        {/* Revised state */}
        {revisionState === "done" && revisedScore !== null && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Clock className="w-3 h-3 flex-shrink-0" style={{ color: "var(--ink-m)" }} />
            <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>
              Revised — pending
            </span>
            <span
              className="text-xs font-mono font-bold"
              style={{ color: revisedScore >= 7 ? "#15803d" : "#dc2626" }}
            >
              New score: {revisedScore.toFixed(1)}/10
            </span>
            {revisedNotes && (
              <span className="text-xs font-sans w-full mt-0.5" style={{ color: "var(--ink-m)" }}>
                {truncate(revisedNotes, 120)}
              </span>
            )}
          </div>
        )}

        {/* Error */}
        {revisionState === "error" && (
          <p className="text-xs font-sans mt-1" style={{ color: "#dc2626" }}>
            {errorMsg}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Revision button — hidden once revision is done */}
        {revisionState !== "done" && (
          revisionState === "loading" ? (
            <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>
              Revising…
            </span>
          ) : (
            <button
              onClick={handleRevise}
              className="flex items-center gap-1 text-xs font-sans px-2.5 py-1.5 transition-opacity hover:opacity-70"
              style={{
                border: "1px solid var(--border)",
                color: "var(--navy)",
                borderRadius: "2px",
                whiteSpace: "nowrap",
              }}
              title="Send back for one revision attempt through the journalist + editor pipeline"
            >
              <RefreshCw className="w-3 h-3" />
              Send for revision
            </button>
          )
        )}

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="flex items-center gap-1 text-xs font-sans px-2.5 py-1.5 transition-opacity hover:opacity-70"
          style={{ color: "#dc2626" }}
          title="Permanently remove from today's digest"
        >
          <X className="w-3 h-3" />
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function RejectedArticlesSection({ rejectedArticles, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Filter out dismissed rows for the count
  const count = rejectedArticles.length;

  if (count === 0) return null;

  return (
    <div style={{ border: "1px solid var(--border)" }}>
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-opacity hover:opacity-70"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: "#dc2626" }}
            aria-hidden="true"
          />
          <span
            className="text-sm font-sans font-medium"
            style={{ color: "var(--navy)" }}
          >
            Rejected by editor in chief ({count}) — not sent for human review
          </span>
        </div>
        {expanded
          ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ink-m)" }} />
          : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ink-m)" }} />
        }
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
