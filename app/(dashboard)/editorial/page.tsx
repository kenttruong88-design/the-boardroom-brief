"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronRight,
  Play, Loader2, Settings, Zap, X, AlertCircle, Clock, RefreshCw, MessageSquare,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";
import RejectedArticlesSection from "@/app/components/editorial/RejectedArticlesSection";
import PipelineProgressPanel from "@/app/components/editorial/PipelineProgressPanel";
import type { DailyDigest, ArticleDraft, EditorReview } from "@/app/lib/agents/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type ArticleEntry = {
  draft: ArticleDraft;
  review: EditorReview;
  approved?: boolean;
  rejected?: boolean;
  sanityDocId?: string;
};

type PillarFilter = "all" | "markets-floor" | "macro-mondays" | "c-suite-circus" | "global-office" | "water-cooler";

const PILLAR_LABELS: Record<string, string> = {
  "all":            "All",
  "markets-floor":  "Markets Floor",
  "macro-mondays":  "Macro Mondays",
  "c-suite-circus": "C-Suite Circus",
  "global-office":  "Global Office",
  "water-cooler":   "Water Cooler",
};

const PILLAR_COLORS: Record<string, string> = {
  "markets-floor":  "#1d4ed8",
  "macro-mondays":  "#15803d",
  "c-suite-circus": "#7c3aed",
  "global-office":  "#b45309",
  "water-cooler":   "#be123c",
};

interface LastRun {
  date: string;
  total_articles_written: number;
  passed_review: number;
  created_at: string;
}

const PILLAR_SLUGS = Object.keys(PILLAR_LABELS).filter((k) => k !== "all") as Exclude<PillarFilter, "all">[];
const LS_THRESHOLD_KEY = "tbb_auto_approve_threshold";

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded" style={{ background: "var(--surface)" }} />
        ))}
      </div>
      {/* Filter bar */}
      <div className="flex gap-2 mb-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-8 w-28 rounded" style={{ background: "var(--surface)" }} />
        ))}
      </div>
      {/* Articles */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-48 rounded mb-4" style={{ background: "var(--surface)" }} />
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  sub,
  color = "var(--navy)",
  dim = false,
}: {
  value: number | string;
  label: string;
  sub?: string;
  color?: string;
  dim?: boolean;
}) {
  return (
    <div
      className="p-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        opacity: dim ? 0.6 : 1,
      }}
    >
      <div className="text-3xl font-serif font-bold mb-1" style={{ color }}>
        {value}
      </div>
      <div className="text-xs font-sans font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--ink-m)" }}>
        {label}
      </div>
      {sub && (
        <div className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>{sub}</div>
      )}
    </div>
  );
}

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 9 ? "#15803d" : score >= 7 ? "#1d4ed8" : "#c8391a";
  return (
    <span
      className="text-xs font-mono font-bold px-2 py-0.5 flex-shrink-0"
      style={{ color, border: `1px solid ${color}`, borderRadius: "2px" }}
    >
      {score.toFixed(1)}/10
    </span>
  );
}

// ── Article card ──────────────────────────────────────────────────────────────

function ArticleCard({
  entry,
  index,
  onApprove,
  onReject,
  approving,
  publishedUrl,
  autoApproved,
}: {
  entry: ArticleEntry;
  index: number;
  onApprove: (i: number) => void;
  onReject: (i: number) => void;
  approving: boolean;
  publishedUrl?: string;
  autoApproved?: boolean;
}) {
  const { draft, review } = entry;
  const [expanded, setExpanded]         = useState(false);
  const [currentImage, setCurrentImage] = useState(draft.featuredImage ?? null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError]     = useState("");
  const pillarColor = PILLAR_COLORS[draft.pillar] ?? "var(--red)";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  async function handleRegenerate() {
    setRegenerating(true);
    setRegenError("");
    try {
      const res = await fetch("/api/editorial/regenerate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: String(index) }),
      });
      const data = await res.json() as { featuredImage?: typeof currentImage; error?: string };
      if (res.ok && data.featuredImage) {
        setCurrentImage(data.featuredImage);
      } else {
        setRegenError(data.error ?? "Regeneration failed");
      }
    } catch {
      setRegenError("Network error");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div
      className="mb-4"
      style={{
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${pillarColor}`,
        background: "var(--surface)",
      }}
    >
      {/* Auto-approve banner */}
      {autoApproved && (
        <div
          className="flex items-center gap-2 px-5 py-2 text-xs font-sans"
          style={{ background: "rgba(21,128,61,0.08)", borderBottom: "1px solid rgba(21,128,61,0.2)", color: "#15803d" }}
        >
          <Zap className="w-3 h-3" />
          Auto-approved
        </div>
      )}

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-2xs font-mono font-semibold uppercase tracking-widest"
                style={{ color: pillarColor }}
              >
                {PILLAR_LABELS[draft.pillar] ?? draft.pillar}
              </span>
              <span className="text-2xs" style={{ color: "var(--border)" }}>·</span>
              <span className="text-2xs font-sans" style={{ color: "var(--ink-m)" }}>{draft.agentName}</span>
            </div>
            <h2
              className="text-xl font-serif font-bold leading-snug mb-1"
              style={{ color: "var(--navy)" }}
            >
              {draft.headline}
            </h2>
            <p className="text-sm font-serif italic" style={{ color: "var(--ink-m)" }}>
              {draft.satiricalHeadline}
            </p>
          </div>
          <ScoreBadge score={review.score} />
        </div>

        {/* Score breakdown */}
        <div className="flex flex-wrap gap-4 mb-4 py-3" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          {[
            { label: "Tone",        val: review.toneScore },
            { label: "Accuracy",    val: review.accuracyScore },
            { label: "Headline",    val: review.headlineScore },
            { label: "Satire",      val: review.satireScore },
            { label: "Originality", val: review.originalityScore },
          ].map(({ label, val }) => {
            const c = val >= 9 ? "#15803d" : val >= 7 ? "#1d4ed8" : val >= 5 ? "#d97706" : "#c8391a";
            return (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold" style={{ color: c }}>{val}</span>
                <span className="text-2xs font-sans uppercase tracking-wide" style={{ color: "var(--ink-m)" }}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Image preview */}
        <div style={{ marginBottom: "1rem", border: "1px solid var(--border)" }}>
          <div style={{ position: "relative", paddingTop: "42%", background: "#e8e4dc", overflow: "hidden" }}>
            {currentImage ? (
              <>
                <img
                  src={currentImage.thumbnailUrl}
                  alt={currentImage.altText}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
                <span style={{
                  position: "absolute", bottom: 6, left: 6,
                  background: "rgba(0,0,0,0.55)", color: "#fff",
                  fontSize: "9px", fontFamily: "Arial, sans-serif", fontWeight: 700,
                  letterSpacing: "0.8px", textTransform: "uppercase",
                  padding: "2px 6px", borderRadius: "2px",
                }}>
                  {currentImage.source === "pexels" ? "Pexels" : currentImage.source === "pillar-default" ? "Default" : "AI generated"}
                </span>
                {regenerating && (
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(15,25,35,0.6)", gap: 8, flexDirection: "column",
                  }}>
                    <Loader2 style={{ width: 20, height: 20, color: "#fff", animation: "spin 1s linear infinite" }} />
                    <span style={{ color: "#fff", fontSize: "11px", fontFamily: "Arial, sans-serif" }}>Generating…</span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {regenerating
                  ? <Loader2 style={{ width: 20, height: 20, color: "var(--ink-m)", animation: "spin 1s linear infinite" }} />
                  : <span style={{ fontSize: "12px", fontFamily: "Arial, sans-serif", color: "var(--ink-m)" }}>No image</span>}
              </div>
            )}
          </div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 8px", background: "var(--cream)", borderTop: "1px solid var(--border)",
            gap: 8,
          }}>
            {/* Source + prompt */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {currentImage && (
                <span style={{
                  flexShrink: 0,
                  fontSize: "10px", fontFamily: "Arial, sans-serif", fontWeight: 700,
                  letterSpacing: "0.6px", textTransform: "uppercase",
                  padding: "1px 5px", borderRadius: "2px",
                  ...(currentImage.source === "flux-schnell"
                    ? { background: "#dbeafe", color: "#1d4ed8" }
                    : currentImage.source === "pexels"
                    ? { background: "#dcfce7", color: "#15803d" }
                    : { background: "#f3f4f6", color: "#6b7280" }),
                }}>
                  {currentImage.source === "flux-schnell" ? "Flux AI" : currentImage.source === "pexels" ? "Pexels" : "Default"}
                </span>
              )}
              <span style={{ fontSize: "10px", fontFamily: "Arial, sans-serif", color: "var(--ink-m)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentImage?.generatedPrompt
                  ? `"${currentImage.generatedPrompt.slice(0, 60)}${currentImage.generatedPrompt.length > 60 ? "…" : ""}"`
                  : currentImage?.source === "pexels" && currentImage.photographerName
                  ? `Photo by ${currentImage.photographerName}`
                  : "no prompt"}
              </span>
            </div>
            <button
              onClick={handleRegenerate}
              disabled={regenerating || !!publishedUrl}
              style={{
                display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                fontSize: "11px", fontFamily: "Arial, sans-serif", fontWeight: 600,
                color: regenerating ? "var(--ink-m)" : "var(--navy)",
                background: "transparent", border: "1px solid var(--border)",
                padding: "3px 8px", borderRadius: "2px", cursor: "pointer",
                opacity: !!publishedUrl ? 0.4 : 1,
              }}
            >
              <RefreshCw style={{ width: 11, height: 11, ...(regenerating ? { animation: "spin 1s linear infinite" } : {}) }} />
              {regenerating ? "Generating…" : "New image"}
            </button>
          </div>
          {regenError && (
            <p style={{ fontSize: "10px", fontFamily: "Arial, sans-serif", color: "var(--red)", padding: "3px 8px", margin: 0 }}>
              {regenError}
            </p>
          )}
        </div>

        {/* Editor notes */}
        <div
          className="text-sm font-sans italic px-3 py-2.5 mb-4"
          style={{ background: "var(--cream)", border: "1px solid var(--border)", color: "var(--ink-m)" }}
        >
          {review.notes}
        </div>

        {/* Preview toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs font-sans mb-3 transition-opacity hover:opacity-60"
          style={{ color: "var(--ink-m)" }}
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {expanded ? "Hide article" : "Preview article"}
        </button>

        {expanded && (
          <div
            className="text-sm font-serif leading-relaxed space-y-4 mb-4 p-4"
            style={{ background: "var(--cream)", border: "1px solid var(--border)", color: "var(--ink)" }}
          >
            {draft.body.split("\n\n").map((para, i) => <p key={i}>{para}</p>)}
          </div>
        )}

        {/* Tags */}
        {draft.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {draft.tags.map((tag) => (
              <span
                key={tag}
                className="text-2xs font-mono px-2 py-0.5"
                style={{ background: "var(--cream)", border: "1px solid var(--border)", color: "var(--ink-m)" }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions / published state */}
        {publishedUrl ? (
          <div
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-sans"
            style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d" }}
          >
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Published —{" "}
            <a
              href={publishedUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#15803d", textDecoration: "underline" }}
            >
              View live →
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onApprove(index)}
              disabled={approving}
              className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2 transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "#15803d", color: "#fff", borderRadius: "2px" }}
            >
              {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {approving ? "Publishing…" : "Approve + Publish"}
            </button>
            <a
              href={`${siteUrl}/studio`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-sans px-4 py-2 transition-opacity hover:opacity-70"
              style={{ border: "1px solid var(--border)", color: "var(--navy)", borderRadius: "2px" }}
            >
              <ExternalLink className="w-4 h-4" /> Edit in Sanity
            </a>
            <button
              onClick={() => onReject(index)}
              className="flex items-center gap-1.5 text-sm font-sans px-4 py-2 transition-opacity hover:opacity-70 ml-auto"
              style={{ color: "var(--red)" }}
            >
              <XCircle className="w-4 h-4" /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Auto-approve modal ────────────────────────────────────────────────────────

function AutoApproveModal({
  current,
  onSave,
  onClose,
}: {
  current: number | null;
  onSave: (threshold: number | null) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current !== null ? String(current) : "");
  const [enabled, setEnabled] = useState(current !== null);

  function handleSave() {
    if (!enabled) { onSave(null); return; }
    const n = parseFloat(value);
    if (isNaN(n) || n < 1 || n > 10) return;
    onSave(Math.round(n * 10) / 10);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,25,35,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md p-8"
        style={{ background: "var(--cream)", border: "2px solid var(--navy)", borderRadius: "2px" }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-serif font-bold" style={{ color: "var(--navy)" }}>
              Auto-approve threshold
            </h2>
            <p className="text-sm font-sans mt-1" style={{ color: "var(--ink-m)" }}>
              Articles scoring above this threshold publish immediately without your click.
            </p>
          </div>
          <button onClick={onClose} className="transition-opacity hover:opacity-60">
            <X className="w-5 h-5" style={{ color: "var(--ink-m)" }} />
          </button>
        </div>

        {/* Toggle */}
        <label className="flex items-center gap-3 mb-6 cursor-pointer">
          <div
            onClick={() => setEnabled((v) => !v)}
            className="relative w-10 h-6 transition-colors"
            style={{ background: enabled ? "#15803d" : "var(--border)", borderRadius: "9999px" }}
          >
            <div
              className="absolute top-1 w-4 h-4 transition-all"
              style={{
                background: "#fff",
                borderRadius: "9999px",
                left: enabled ? "calc(100% - 1.25rem)" : "0.25rem",
              }}
            />
          </div>
          <span className="text-sm font-sans font-medium" style={{ color: "var(--navy)" }}>
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </label>

        {/* Threshold input */}
        {enabled && (
          <div className="mb-6">
            <label className="block text-xs font-sans font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-m)" }}>
              Score threshold (1.0 – 10.0)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-24 px-3 py-2 text-sm font-mono"
                style={{
                  background: "#fff",
                  border: "1px solid var(--border)",
                  color: "var(--navy)",
                  outline: "none",
                }}
                placeholder="9.0"
              />
              <span className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>/ 10</span>
            </div>
            <p className="text-xs font-sans mt-2" style={{ color: "var(--ink-m)" }}>
              Suggested: 9.0 — catches only the highest-scoring articles.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 text-sm font-sans font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--navy)", color: "var(--cream)", borderRadius: "2px" }}
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-sans transition-opacity hover:opacity-70"
            style={{ border: "1px solid var(--border)", color: "var(--navy)", borderRadius: "2px" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Force-run confirmation modal ──────────────────────────────────────────────

function ForceRunModal({
  articlesProduced,
  onConfirm,
  onClose,
}: {
  articlesProduced: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,25,35,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm p-8"
        style={{ background: "var(--cream)", border: "2px solid var(--navy)", borderRadius: "2px" }}
      >
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#d97706" }} />
          <div>
            <h2 className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>
              Pipeline already ran today
            </h2>
            <p className="text-sm font-sans mt-1" style={{ color: "var(--ink-m)" }}>
              The pipeline ran this morning and produced{" "}
              <strong style={{ color: "var(--navy)" }}>{articlesProduced}</strong>{" "}
              article{articlesProduced !== 1 ? "s" : ""}. Run again anyway?
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-sans font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--navy)", color: "var(--cream)", borderRadius: "2px" }}
          >
            Run again
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-sans transition-opacity hover:opacity-70"
            style={{ border: "1px solid var(--border)", color: "var(--navy)", borderRadius: "2px" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EditorialDashboard() {
  const router = useRouter();

  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [articlesApproved, setArticlesApproved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingCommentCount, setPendingCommentCount] = useState(0);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  // Per-article action state
  const [actioned, setActioned]       = useState<Record<number, "approved" | "rejected">>({});
  const [publishedUrls, setPublishedUrls] = useState<Record<number, string>>({});
  const [approvingIndex, setApprovingIndex] = useState<number | null>(null);
  const [autoApprovedIndices, setAutoApprovedIndices] = useState<Set<number>>(new Set());

  // Filters
  const [activePillar, setActivePillar] = useState<PillarFilter>("all");

  // Bulk approve
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkResult, setBulkResult] = useState("");

  // Pipeline trigger
  const [triggering, setTriggering]                     = useState(false);
  const [activeJobId, setActiveJobId]                   = useState<string | null>(null);
  const [showPanel, setShowPanel]                       = useState(false);
  const [showForceModal, setShowForceModal]             = useState(false);
  const [forceArticlesProduced, setForceArticlesProduced] = useState(0);
  const [triggerError, setTriggerError]                 = useState("");

  // Last run indicator
  const [lastRun, setLastRun] = useState<LastRun | null>(null);

  // Auto-approve modal + threshold
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoThreshold, setAutoThreshold] = useState<number | null>(null);
  const [autoApproveBanner, setAutoApproveBanner] = useState("");

  // Load threshold from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(LS_THRESHOLD_KEY);
    if (stored !== null) {
      const n = parseFloat(stored);
      if (!isNaN(n)) setAutoThreshold(n);
    }
  }, []);

  // Auth check
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
      } else {
        setAuthed(true);
        // Fetch pending comment count for badge
        fetch("/api/admin/comments?status=pending&page=1")
          .then((r) => r.json())
          .then((d: { stats?: { pending?: number } }) => {
            if (d.stats?.pending !== undefined) setPendingCommentCount(d.stats.pending);
          })
          .catch(() => {});
      }
    });
  }, [router]);

  // Run auto-approve after data loads
  const runAutoApprove = useCallback(
    async (
      articles: ArticleEntry[],
      threshold: number,
      alreadyActioned: Record<number, "approved" | "rejected">
    ) => {
      const targets = articles
        .map((entry, i) => ({ entry: entry as ArticleEntry, i }))
        .filter(({ entry, i }) =>
          entry.review.passed &&
          entry.review.score >= threshold &&
          !entry.approved &&
          !entry.rejected &&
          !alreadyActioned[i]
        );

      if (targets.length === 0) return;

      const newActioned: Record<number, "approved" | "rejected"> = {};
      const newUrls: Record<number, string> = {};
      const newAutoIndices: number[] = [];

      for (const { i } of targets) {
        try {
          const res = await fetch("/api/editorial/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ articleId: String(i) }),
          });
          const data = await res.json() as { success?: boolean; publishedUrl?: string };
          if (res.ok && data.success) {
            newActioned[i] = "approved";
            newAutoIndices.push(i);
            if (data.publishedUrl) newUrls[i] = data.publishedUrl;
          }
        } catch {
          // non-fatal — skip this article
        }
      }

      if (newAutoIndices.length > 0) {
        setActioned((prev) => ({ ...prev, ...newActioned }));
        setPublishedUrls((prev) => ({ ...prev, ...newUrls }));
        setAutoApprovedIndices((prev) => new Set([...prev, ...newAutoIndices]));
        setAutoApproveBanner(
          `Auto-approved ${newAutoIndices.length} article${newAutoIndices.length !== 1 ? "s" : ""} (score ≥ ${threshold}/10)`
        );
      }
    },
    []
  );

  // Fetch digest
  const fetchDigest = useCallback(async () => {
    setError("");
    try {
      const r = await fetch("/api/editorial/review");
      const data = await r.json() as {
        status: string;
        digest?: DailyDigest;
        articlesApproved?: number;
        lastRun?: LastRun;
      };
      if (data.lastRun) setLastRun(data.lastRun);
      if (data.digest) {
        setDigest(data.digest);
        setArticlesApproved(data.articlesApproved ?? 0);

        // Auto-approve if threshold set
        const stored = localStorage.getItem(LS_THRESHOLD_KEY);
        if (stored !== null) {
          const threshold = parseFloat(stored);
          if (!isNaN(threshold)) {
            await runAutoApprove(
              data.digest.articles as ArticleEntry[],
              threshold,
              {} // fresh load — nothing actioned yet
            );
          }
        }
      } else {
        setError("No digest found for today. Run the pipeline to generate one.");
      }
    } catch {
      setError("Failed to load digest.");
    } finally {
      setLoading(false);
    }
  }, [runAutoApprove]);

  useEffect(() => {
    if (authed) fetchDigest();
  }, [authed, fetchDigest]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleApprove(index: number) {
    setApprovingIndex(index);
    try {
      const res = await fetch("/api/editorial/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: String(index) }),
      });
      const data = await res.json() as { success?: boolean; publishedUrl?: string; error?: string };
      if (res.ok && data.success) {
        setActioned((prev) => ({ ...prev, [index]: "approved" }));
        setArticlesApproved((n) => n + 1);
        if (data.publishedUrl) setPublishedUrls((prev) => ({ ...prev, [index]: data.publishedUrl! }));
      } else {
        alert(data.error ?? "Approval failed.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setApprovingIndex(null);
    }
  }

  async function handleReject(index: number) {
    await fetch("/api/editorial/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: String(index) }),
    });
    setActioned((prev) => ({ ...prev, [index]: "rejected" }));
  }

  async function handleBulkApprove() {
    setBulkApproving(true);
    setBulkResult("");
    try {
      const res = await fetch("/api/editorial/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json() as {
        approvedCount?: number;
        failedCount?: number;
        publishedUrls?: string[];
        error?: string;
      };
      if (res.ok) {
        const count = data.approvedCount ?? 0;
        setBulkResult(`Published ${count} article${count !== 1 ? "s" : ""}${data.failedCount ? ` (${data.failedCount} failed)` : ""}`);
        // Refresh to get updated actioned state
        await fetchDigest();
      } else {
        setBulkResult(data.error ?? "Bulk approve failed.");
      }
    } catch {
      setBulkResult("Network error.");
    } finally {
      setBulkApproving(false);
    }
  }

  async function handleTriggerPipeline(force = false) {
    setTriggering(true);
    setTriggerError("");
    try {
      const res = await fetch("/api/newsroom/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(force ? { force: true } : {}),
      });
      const data = await res.json() as {
        jobId?: string;
        status?: string;
        error?: string;
        articlesProduced?: number;
      };

      if (data.status === "already_running" && data.jobId) {
        // Pipeline is already running — open the panel for the existing job
        setActiveJobId(data.jobId);
        setShowPanel(true);
      } else if (data.status === "already_ran") {
        // Show confirmation modal
        setForceArticlesProduced(data.articlesProduced ?? 0);
        setShowForceModal(true);
      } else if (data.status === "started" && data.jobId) {
        setActiveJobId(data.jobId);
        setShowPanel(true);
      } else {
        setTriggerError(data.error ?? "Failed to start pipeline.");
      }
    } catch {
      setTriggerError("Network error. Please try again.");
    } finally {
      setTriggering(false);
    }
  }

  function handleSaveThreshold(threshold: number | null) {
    setAutoThreshold(threshold);
    if (threshold === null) {
      localStorage.removeItem(LS_THRESHOLD_KEY);
    } else {
      localStorage.setItem(LS_THRESHOLD_KEY, String(threshold));
    }
    setShowAutoModal(false);
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const allPassing = useMemo(() => {
    if (!digest) return [];
    return digest.articles
      .map((entry, i) => ({ entry: entry as ArticleEntry, i }))
      .filter(({ entry }) => entry.review.passed);
  }, [digest]);

  const pendingPassing = useMemo(
    () => allPassing.filter(({ i }) => !actioned[i]),
    [allPassing, actioned]
  );

  const rejected = useMemo(() => {
    if (!digest) return [];
    return digest.articles
      .map((entry, i) => ({ ...(entry as ArticleEntry), articleIndex: i }))
      .filter(({ review, articleIndex }) => !review.passed || actioned[articleIndex] === "rejected");
  }, [digest, actioned]);

  // Pillar counts (from all passing, regardless of filter)
  const pillarCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allPassing.forEach(({ entry }) => {
      const p = entry.draft.pillar;
      counts[p] = (counts[p] ?? 0) + 1;
    });
    return counts;
  }, [allPassing]);

  // Filtered passing articles
  const filteredPassing = useMemo(() => {
    if (activePillar === "all") return pendingPassing;
    return pendingPassing.filter(({ entry }) => entry.draft.pillar === activePillar);
  }, [pendingPassing, activePillar]);

  // Today's date
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ── Early states ───────────────────────────────────────────────────────────

  if (authed === null) return null;

  if (loading) {
    return (
      <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
        <div className="container-editorial py-10">
          <div className="mb-8 pb-6" style={{ borderBottom: "2px solid var(--navy)" }}>
            <div className="h-4 w-32 rounded mb-2 animate-pulse" style={{ background: "var(--surface)" }} />
            <div className="h-9 w-80 rounded animate-pulse" style={{ background: "var(--surface)" }} />
          </div>
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="container-editorial py-10">

        {/* ── MODALS ── */}
        {showAutoModal && (
          <AutoApproveModal
            current={autoThreshold}
            onSave={handleSaveThreshold}
            onClose={() => setShowAutoModal(false)}
          />
        )}
        {showForceModal && (
          <ForceRunModal
            articlesProduced={forceArticlesProduced}
            onConfirm={() => { setShowForceModal(false); handleTriggerPipeline(true); }}
            onClose={() => setShowForceModal(false)}
          />
        )}

        {/* ── HEADER ── */}
        <div className="flex items-start justify-between gap-6 mb-8 pb-6" style={{ borderBottom: "2px solid var(--navy)" }}>
          <div>
            <p className="eyebrow mb-1">Editorial Dashboard</p>
            <h1 className="text-3xl font-serif font-bold" style={{ color: "var(--navy)" }}>
              Daily Review
            </h1>
            <p className="text-sm font-sans mt-1" style={{ color: "var(--ink-m)" }}>{today}</p>

            {/* Last run indicator */}
            {lastRun && (() => {
              const ranDate = lastRun.date;
              const todayStr = new Date().toISOString().split("T")[0];
              const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
              const dotColor = ranDate === todayStr ? "#15803d" : ranDate === yesterdayStr ? "#d97706" : "#6b6558";
              const label = ranDate === todayStr ? "today" : ranDate === yesterdayStr ? "yesterday" : ranDate;
              const time = new Date(lastRun.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
              return (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                  <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>
                    Last run: {label} {time} UTC · {lastRun.total_articles_written} articles
                  </span>
                </div>
              );
            })()}

            {autoThreshold !== null && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Zap className="w-3 h-3" style={{ color: "#15803d" }} />
                <span className="text-xs font-sans" style={{ color: "#15803d" }}>
                  Auto-approve active — threshold {autoThreshold}/10
                </span>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <button
              onClick={() => showPanel ? setShowPanel(false) : handleTriggerPipeline(false)}
              disabled={triggering}
              className="flex items-center gap-2 text-sm font-sans font-semibold px-4 py-2.5 transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--navy)", color: "var(--cream)", borderRadius: "2px" }}
            >
              {triggering
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : showPanel
                  ? <Clock className="w-4 h-4" />
                  : <Play className="w-4 h-4" />}
              {triggering ? "Starting…" : showPanel ? "View progress" : "Run pipeline now"}
            </button>
            {triggerError && (
              <p className="text-xs font-sans" style={{ color: "var(--red)" }}>{triggerError}</p>
            )}
            <a
              href="/editorial/comments"
              className="flex items-center gap-1.5 text-xs font-sans"
              style={{ color: "var(--ink-m)", textDecoration: "none" }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Comment moderation
              {pendingCommentCount > 0 && (
                <span style={{ background: "var(--red)", color: "#fff", fontFamily: "var(--font-jetbrains)", fontSize: "0.55rem", padding: "1px 5px" }}>
                  {pendingCommentCount}
                </span>
              )}
            </a>
          </div>
        </div>

        {/* ── PIPELINE PROGRESS PANEL ── */}
        <div
          style={{
            overflow: "hidden",
            maxHeight: showPanel && activeJobId ? "700px" : "0",
            transition: "max-height 0.3s ease-in-out",
            marginBottom: showPanel && activeJobId ? "2rem" : "0",
          }}
        >
          {activeJobId && (
            <PipelineProgressPanel
              jobId={activeJobId}
              onClose={() => setShowPanel(false)}
              onComplete={async () => {
                setShowPanel(false);
                await fetchDigest();
              }}
            />
          )}
        </div>

        {/* ── ERROR STATE ── */}
        {error && (
          <div
            className="p-4 mb-8 text-sm font-sans"
            style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "var(--red)" }}
          >
            {error}
          </div>
        )}

        {/* ── AUTO-APPROVE BANNER ── */}
        {autoApproveBanner && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 mb-6 text-sm font-sans"
            style={{ background: "rgba(21,128,61,0.08)", border: "1px solid rgba(21,128,61,0.25)", color: "#15803d" }}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 flex-shrink-0" />
              {autoApproveBanner}
            </div>
            <button onClick={() => setAutoApproveBanner("")} className="transition-opacity hover:opacity-60">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STATS ROW ── */}
        {digest && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              value={digest.totalArticles}
              label="Articles written"
              sub={`by ${digest.totalArticles > 0 ? "5" : "0"} agents`}
            />
            <StatCard
              value={digest.passedArticles}
              label="Passed review"
              color="#15803d"
              sub="editor score ≥ 7.0"
            />
            <StatCard
              value={digest.rejectedArticles}
              label="Rejected"
              color="var(--red)"
              dim={digest.rejectedArticles === 0}
              sub="score < 7.0"
            />
            <StatCard
              value={articlesApproved}
              label="Approved by you"
              color="#1d4ed8"
              dim={articlesApproved === 0}
              sub={articlesApproved > 0 ? "published to Sanity" : "none yet"}
            />
          </div>
        )}

        {/* ── FILTER BAR + BULK ACTIONS ── */}
        {digest && (
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            {/* Pillar filter tabs */}
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...PILLAR_SLUGS] as PillarFilter[]).map((tab) => {
                const active = activePillar === tab;
                const count = tab === "all"
                  ? pendingPassing.length
                  : (pillarCounts[tab] ?? 0);
                return (
                  <button
                    key={tab}
                    onClick={() => setActivePillar(tab)}
                    className="text-xs font-sans px-3 py-1.5 transition-all"
                    style={{
                      background:   active ? "var(--navy)" : "transparent",
                      color:        active ? "var(--cream)" : "var(--ink-m)",
                      border:       `1px solid ${active ? "var(--navy)" : "var(--border)"}`,
                      borderRadius: "2px",
                      fontWeight:   active ? "600" : "400",
                    }}
                  >
                    {PILLAR_LABELS[tab]}
                    {count > 0 && (
                      <span
                        className="ml-1.5 text-2xs"
                        style={{ opacity: active ? 0.7 : 0.5 }}
                      >
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bulk actions */}
            <div className="flex items-center gap-2">
              {pendingPassing.length > 1 && (
                <button
                  onClick={handleBulkApprove}
                  disabled={bulkApproving}
                  className="flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-1.5 transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "#15803d", color: "#fff", borderRadius: "2px" }}
                >
                  {bulkApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  {bulkApproving ? "Approving…" : `Approve all ${pendingPassing.length}`}
                </button>
              )}
              <button
                onClick={() => setShowAutoModal(true)}
                className="flex items-center gap-1.5 text-xs font-sans px-3 py-1.5 transition-opacity hover:opacity-70"
                style={{
                  border: `1px solid ${autoThreshold !== null ? "#15803d" : "var(--border)"}`,
                  color: autoThreshold !== null ? "#15803d" : "var(--ink-m)",
                  borderRadius: "2px",
                }}
              >
                <Settings className="w-3 h-3" />
                {autoThreshold !== null ? `Auto ≥ ${autoThreshold}` : "Auto-approve"}
              </button>
              {bulkResult && (
                <span
                  className="text-xs font-sans"
                  style={{ color: bulkResult.includes("failed") ? "var(--red)" : "#15803d" }}
                >
                  {bulkResult}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── PASSING ARTICLES ── */}
        {digest && (
          <>
            {filteredPassing.length > 0 ? (
              <div className="mb-10">
                <p className="eyebrow mb-5">
                  Ready for review
                  {activePillar !== "all" ? ` — ${PILLAR_LABELS[activePillar]}` : ""}
                  {" "}({filteredPassing.length})
                </p>
                {filteredPassing.map(({ entry, i }) => (
                  <ArticleCard
                    key={i}
                    entry={entry as ArticleEntry}
                    index={i}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    approving={approvingIndex === i}
                    publishedUrl={publishedUrls[i]}
                    autoApproved={autoApprovedIndices.has(i)}
                  />
                ))}
              </div>
            ) : (
              <div
                className="py-16 text-center mb-10"
                style={{ border: "1px solid var(--border)" }}
              >
                <p className="eyebrow-muted mb-2">
                  {pendingPassing.length === 0
                    ? "No articles pending review"
                    : "No articles in this pillar"}
                </p>
                {pendingPassing.length === 0 && (
                  <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>
                    {articlesApproved > 0
                      ? `You've published all ${articlesApproved} passing article${articlesApproved !== 1 ? "s" : ""} today.`
                      : "Run the pipeline above to generate today's articles."}
                  </p>
                )}
              </div>
            )}

            {/* ── REJECTED SECTION ── */}
            <RejectedArticlesSection
              rejectedArticles={rejected}
              onDismiss={(articleIndex) =>
                setActioned((prev) => ({ ...prev, [articleIndex]: "rejected" }))
              }
            />
          </>
        )}

      </div>
    </div>
  );
}
