"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase";
import {
  CheckCircle,
  XCircle,
  Ban,
  ChevronDown,
  ChevronRight,
  SkipForward,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { AdminComment, CommentStats } from "@/app/api/admin/comments/route";

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusFilter = "pending" | "approved" | "rejected" | "spam";
type DateFilter = "today" | "7days" | "all";

interface ArticleOption {
  slug: string;
  title: string;
}

interface BannedUser {
  id: string;
  ip_hash: string | null;
  email: string | null;
  reason: string | null;
  banned_by: string | null;
  created_at: string;
  expires_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ScorePill({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: number | null;
  invert?: boolean;
}) {
  if (value === null) return null;
  const effective = invert ? 10 - value : value;
  const color =
    effective >= 8 ? "#16a34a" : effective >= 6 ? "#b8960c" : "#c8391a";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontFamily: "var(--font-jetbrains)",
        fontSize: "0.6rem",
        padding: "2px 6px",
        border: `1px solid ${color}22`,
        background: `${color}12`,
        color,
        letterSpacing: "0.04em",
      }}
    >
      {label}{" "}
      <strong style={{ fontWeight: 700 }}>{value.toFixed(1)}</strong>
    </span>
  );
}

function ActionBtn({
  icon,
  label,
  color,
  shortcut,
  onClick,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  shortcut?: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        background: color,
        color: "#fff",
        border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "var(--font-dm-sans)",
        fontSize: "0.78rem",
        fontWeight: 600,
        opacity: loading ? 0.6 : 1,
        transition: "opacity 0.15s",
        position: "relative",
      }}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
      {shortcut && (
        <span
          style={{
            fontFamily: "var(--font-jetbrains)",
            fontSize: "0.55rem",
            background: "rgba(255,255,255,0.25)",
            padding: "1px 4px",
            letterSpacing: "0.04em",
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CommentModerationPage() {
  const router = useRouter();

  // Auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login?next=/editorial/comments");
    });
  }, [router]);

  // Data
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<CommentStats>({
    pending: 0,
    approvedToday: 0,
    rejectedToday: 0,
    banned: 0,
  });
  const [articles, setArticles] = useState<ArticleOption[]>([]);
  const [bans, setBans] = useState<BannedUser[]>([]);
  const [bansOpen, setBansOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // Filters
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [articleFilter, setArticleFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [page, setPage] = useState(1);

  // Keyboard nav
  const [focused, setFocused] = useState(0);
  const focusedRef = useRef(0);
  focusedRef.current = focused;

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      status,
      page: String(page),
      dateRange: dateFilter,
    });
    if (articleFilter) params.set("articleId", articleFilter);

    try {
      const res = await fetch(`/api/admin/comments?${params}`);
      const data = (await res.json()) as {
        comments: AdminComment[];
        total: number;
        stats: CommentStats;
        articles: ArticleOption[];
      };
      setComments(data.comments ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? { pending: 0, approvedToday: 0, rejectedToday: 0, banned: 0 });
      setArticles(data.articles ?? []);
      setFocused(0);
    } finally {
      setLoading(false);
    }
  }, [status, page, articleFilter, dateFilter]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [status, articleFilter, dateFilter]);

  // Fetch bans when section opens
  useEffect(() => {
    if (!bansOpen) return;
    fetch("/api/admin/comments/bans")
      .then((r) => r.json())
      .then((d: { bans?: BannedUser[] }) => setBans(d.bans ?? []))
      .catch(() => {});
  }, [bansOpen]);

  // ── Moderation actions ─────────────────────────────────────────────────────

  async function moderate(commentId: string, action: string) {
    setActionLoading((p) => ({ ...p, [commentId]: true }));
    try {
      await fetch("/api/comments/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, commentId }),
      });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setStats((s) => ({
        ...s,
        pending: action === "approve" || action === "reject" ? Math.max(0, s.pending - 1) : s.pending,
        approvedToday: action === "approve" ? s.approvedToday + 1 : s.approvedToday,
        rejectedToday: action === "reject" ? s.rejectedToday + 1 : s.rejectedToday,
        banned: action === "ban_user" ? s.banned + 1 : s.banned,
      }));
      // Advance focus
      setFocused((f) => Math.max(0, f));
    } finally {
      setActionLoading((p) => ({ ...p, [commentId]: false }));
    }
  }

  async function handleBulkApprove() {
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/admin/comments/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minScore: 7.5 }),
      });
      const data = (await res.json()) as { approved?: number; error?: string };
      if (data.error) {
        setBulkResult(`Error: ${data.error}`);
      } else {
        setBulkResult(`Approved ${data.approved ?? 0} comments.`);
        fetchComments();
      }
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleUnban(banId: string) {
    await fetch(`/api/admin/comments/bans/${banId}`, { method: "DELETE" });
    setBans((prev) => prev.filter((b) => b.id !== banId));
    setStats((s) => ({ ...s, banned: Math.max(0, s.banned - 1) }));
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't fire when typing in inputs/textareas
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;

      const idx = focusedRef.current;
      const comment = comments[idx];
      if (!comment) return;

      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        moderate(comment.id, "approve");
        setFocused((f) => Math.min(f + 1, comments.length - 1));
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        moderate(comment.id, "reject");
        setFocused((f) => Math.min(f + 1, comments.length - 1));
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setFocused((f) => Math.min(f + 1, comments.length - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [comments]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabCounts: Record<StatusFilter, number> = {
    pending: stats.pending,
    approved: stats.approvedToday,
    rejected: stats.rejectedToday,
    spam: 0,
  };

  const totalPages = Math.ceil(total / 25);

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <div className="container-editorial py-8">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-1">
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
              }}
            >
              ← Editorial
            </button>
          </div>
          <h1
            className="font-serif font-bold"
            style={{ fontSize: "1.75rem", color: "var(--navy)", marginBottom: 16 }}
          >
            Comment Moderation
          </h1>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Pending review",
                value: stats.pending,
                action: () => setStatus("pending"),
                highlight: stats.pending > 0,
              },
              { label: "Approved today", value: stats.approvedToday, action: () => setStatus("approved") },
              { label: "Rejected today", value: stats.rejectedToday, action: () => setStatus("rejected") },
              { label: "Banned users", value: stats.banned, action: () => setBansOpen(true) },
            ].map(({ label, value, action, highlight }) => (
              <button
                key={label}
                onClick={action}
                style={{
                  background: highlight ? "var(--navy)" : "var(--surface)",
                  border: `1px solid ${highlight ? "transparent" : "var(--border)"}`,
                  padding: "12px 16px",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-jetbrains)",
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: highlight ? "var(--cream)" : "var(--navy)",
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {value}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-jetbrains)",
                    fontSize: "0.6rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: highlight ? "rgba(245,240,232,0.7)" : "var(--ink-m)",
                  }}
                >
                  {label}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rule-thick mb-6" />

        {/* ── Filter row ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4 mb-6">

          {/* Status tabs */}
          <div className="flex items-center gap-0">
            {(["pending", "approved", "rejected", "spam"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  padding: "6px 14px",
                  border: "1px solid var(--border)",
                  marginLeft: -1,
                  background: status === s ? "var(--navy)" : "transparent",
                  color: status === s ? "var(--cream)" : "var(--ink-m)",
                  fontFamily: "var(--font-jetbrains)",
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                  position: "relative",
                  zIndex: status === s ? 1 : 0,
                }}
              >
                {s}
                {s in tabCounts && tabCounts[s as StatusFilter] > 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      background: status === s ? "rgba(255,255,255,0.2)" : "var(--navy)",
                      color: status === s ? "var(--cream)" : "var(--cream)",
                      fontFamily: "var(--font-jetbrains)",
                      fontSize: "0.55rem",
                      padding: "1px 5px",
                      borderRadius: 0,
                    }}
                  >
                    {tabCounts[s as StatusFilter]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Article filter */}
          {articles.length > 0 && (
            <select
              value={articleFilter}
              onChange={(e) => setArticleFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid var(--border)",
                background: "#fff",
                color: "var(--navy)",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.8rem",
                outline: "none",
                maxWidth: 260,
              }}
            >
              <option value="">All articles</option>
              {articles.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.title !== a.slug ? a.title : a.slug}
                </option>
              ))}
            </select>
          )}

          {/* Date filter */}
          <div className="flex items-center gap-0 ml-auto">
            {(["today", "7days", "all"] as DateFilter[]).map((d, i) => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                style={{
                  padding: "6px 12px",
                  border: "1px solid var(--border)",
                  marginLeft: i === 0 ? 0 : -1,
                  background: dateFilter === d ? "var(--surface)" : "transparent",
                  color: dateFilter === d ? "var(--navy)" : "var(--ink-m)",
                  fontFamily: "var(--font-jetbrains)",
                  fontSize: "0.6rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                  fontWeight: dateFilter === d ? 600 : 400,
                }}
              >
                {d === "7days" ? "7 days" : d === "today" ? "Today" : "All time"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Keyboard hint ────────────────────────────────────────────────── */}
        {status === "pending" && comments.length > 0 && (
          <div
            className="flex items-center gap-4 mb-4 px-3 py-2"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-jetbrains)",
              fontSize: "0.6rem",
              color: "var(--ink-m)",
              letterSpacing: "0.04em",
            }}
          >
            <span>Keyboard shortcuts:</span>
            {[
              { key: "A", desc: "Approve" },
              { key: "R", desc: "Reject" },
              { key: "N", desc: "Next" },
            ].map(({ key, desc }) => (
              <span key={key} className="flex items-center gap-1">
                <span
                  style={{
                    background: "var(--navy)",
                    color: "var(--cream)",
                    padding: "2px 5px",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                  }}
                >
                  {key}
                </span>
                {desc}
              </span>
            ))}
            <span style={{ marginLeft: "auto" }}>
              Reviewing {Math.min(focused + 1, comments.length)} of {comments.length}
            </span>
          </div>
        )}

        {/* ── Bulk action ──────────────────────────────────────────────────── */}
        {status === "pending" && (
          <div
            className="flex items-center justify-between mb-4 px-4 py-3"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "0.875rem",
                  color: "var(--navy)",
                  fontWeight: 600,
                }}
              >
                Bulk auto-approve
              </span>
              <span
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "0.8rem",
                  color: "var(--ink-m)",
                  marginLeft: 8,
                }}
              >
                Approve all pending comments with overall score ≥ 7.5
              </span>
            </div>
            <div className="flex items-center gap-3">
              {bulkResult && (
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains)",
                    fontSize: "0.65rem",
                    color: "var(--ink-m)",
                  }}
                >
                  {bulkResult}
                </span>
              )}
              <button
                onClick={handleBulkApprove}
                disabled={bulkLoading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 16px",
                  background: "#16a34a",
                  color: "#fff",
                  border: "none",
                  cursor: bulkLoading ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  opacity: bulkLoading ? 0.6 : 1,
                }}
              >
                {bulkLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                Approve all with score &gt; 7.5
              </button>
            </div>
          </div>
        )}

        {/* ── Comment queue ────────────────────────────────────────────────── */}
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 0",
              color: "var(--ink-m)",
              fontFamily: "var(--font-jetbrains)",
              fontSize: "0.7rem",
              letterSpacing: "0.07em",
            }}
          >
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3" style={{ color: "var(--navy)" }} />
            Loading…
          </div>
        ) : comments.length === 0 ? (
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
            No {status} comments
            {articleFilter ? ` for this article` : ""}.
          </div>
        ) : (
          <div className="space-y-0">
            {comments.map((comment, idx) => {
              const isFocused = focused === idx;
              const isActing = actionLoading[comment.id];
              return (
                <div
                  key={comment.id}
                  onClick={() => setFocused(idx)}
                  style={{
                    background: isFocused ? "#fff" : "var(--surface)",
                    border: "1px solid var(--border)",
                    borderLeft: `3px solid ${isFocused ? "var(--navy)" : "transparent"}`,
                    marginBottom: -1,
                    padding: "16px 20px",
                    cursor: "pointer",
                    transition: "background 0.1s, border-left-color 0.1s",
                    opacity: isActing ? 0.5 : 1,
                  }}
                >
                  {/* Article link */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {comment.articlePillarSlug && comment.articleTitle ? (
                        <a
                          href={`/${comment.articlePillarSlug}/${comment.articleId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 hover-card"
                          style={{
                            fontFamily: "var(--font-dm-sans)",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color: "var(--navy)",
                            textDecoration: "none",
                            borderBottom: "1px solid var(--border)",
                            paddingBottom: 1,
                          }}
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{comment.articleTitle}</span>
                        </a>
                      ) : (
                        <span
                          style={{
                            fontFamily: "var(--font-jetbrains)",
                            fontSize: "0.65rem",
                            color: "var(--ink-m)",
                          }}
                        >
                          {comment.articleId}
                        </span>
                      )}
                      {comment.parentId && (
                        <span
                          style={{
                            fontFamily: "var(--font-jetbrains)",
                            fontSize: "0.55rem",
                            background: "var(--border)",
                            color: "var(--ink-m)",
                            padding: "1px 5px",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Reply
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains)",
                        fontSize: "0.6rem",
                        color: "var(--ink-m)",
                        flexShrink: 0,
                      }}
                    >
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>

                  {/* Author */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--navy)",
                        color: "var(--cream)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-jetbrains)",
                        fontSize: "0.55rem",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {comment.authorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-dm-sans)",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "var(--navy)",
                        }}
                      >
                        {comment.authorName}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-jetbrains)",
                          fontSize: "0.6rem",
                          color: "var(--ink-m)",
                        }}
                      >
                        {comment.authorEmail}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: "0.875rem",
                      color: "var(--ink)",
                      lineHeight: 1.65,
                      marginBottom: 12,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {comment.body}
                  </p>

                  {/* AI scores */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <ScorePill label="spam" value={comment.modSpam} invert />
                    <ScorePill label="toxicity" value={comment.modToxicity} invert />
                    <ScorePill label="relevance" value={comment.modRelevance} />
                    {comment.overallScore !== null && (
                      <ScorePill label="overall" value={comment.overallScore} />
                    )}
                    {comment.modReason && (
                      <span
                        style={{
                          fontFamily: "var(--font-dm-sans)",
                          fontSize: "0.75rem",
                          color: "var(--ink-m)",
                          fontStyle: "italic",
                          paddingLeft: 4,
                        }}
                      >
                        "{comment.modReason}"
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <ActionBtn
                      icon={<CheckCircle className="w-3.5 h-3.5" />}
                      label="Approve"
                      color="#16a34a"
                      shortcut={isFocused ? "A" : undefined}
                      onClick={() => moderate(comment.id, "approve")}
                      loading={isActing}
                    />
                    <ActionBtn
                      icon={<XCircle className="w-3.5 h-3.5" />}
                      label="Reject"
                      color="var(--red)"
                      shortcut={isFocused ? "R" : undefined}
                      onClick={() => moderate(comment.id, "reject")}
                      loading={isActing}
                    />
                    <ActionBtn
                      icon={<Ban className="w-3.5 h-3.5" />}
                      label="Ban user"
                      color="#7f1d1d"
                      onClick={() => moderate(comment.id, "ban_user")}
                      loading={isActing}
                    />
                    {isFocused && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocused((f) => Math.min(f + 1, comments.length - 1));
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "6px 12px",
                          background: "transparent",
                          border: "1px solid var(--border)",
                          color: "var(--ink-m)",
                          cursor: "pointer",
                          fontFamily: "var(--font-jetbrains)",
                          fontSize: "0.6rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        <SkipForward className="w-3 h-3" />
                        Next
                        <span
                          style={{
                            background: "var(--surface)",
                            padding: "1px 4px",
                            fontSize: "0.55rem",
                          }}
                        >
                          N
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-outline"
              style={{ fontSize: "0.75rem", padding: "5px 12px", opacity: page === 1 ? 0.4 : 1 }}
            >
              ← Prev
            </button>
            <span
              style={{
                fontFamily: "var(--font-jetbrains)",
                fontSize: "0.65rem",
                color: "var(--ink-m)",
                padding: "0 8px",
              }}
            >
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-outline"
              style={{ fontSize: "0.75rem", padding: "5px 12px", opacity: page === totalPages ? 0.4 : 1 }}
            >
              Next →
            </button>
          </div>
        )}

        {/* ── Banned users section ─────────────────────────────────────────── */}
        <div className="mt-10">
          <button
            onClick={() => setBansOpen((v) => !v)}
            className="flex items-center gap-2 w-full"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "12px 0",
              borderTop: "2px solid var(--navy)",
            }}
          >
            {bansOpen ? (
              <ChevronDown className="w-4 h-4" style={{ color: "var(--navy)" }} />
            ) : (
              <ChevronRight className="w-4 h-4" style={{ color: "var(--navy)" }} />
            )}
            <span
              style={{
                fontFamily: "var(--font-jetbrains)",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--navy)",
                fontWeight: 600,
              }}
            >
              Banned users ({stats.banned})
            </span>
          </button>

          {bansOpen && (
            <div style={{ marginTop: 12 }}>
              {bans.length === 0 ? (
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "0.875rem",
                    color: "var(--ink-m)",
                    fontStyle: "italic",
                    padding: "12px 0",
                  }}
                >
                  No banned users.
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Email / IP", "Reason", "Banned by", "Date", ""].map((h) => (
                        <th
                          key={h}
                          style={{
                            fontFamily: "var(--font-jetbrains)",
                            fontSize: "0.6rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            color: "var(--ink-m)",
                            padding: "8px 12px",
                            textAlign: "left",
                            fontWeight: 500,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bans.map((ban) => (
                      <tr
                        key={ban.id}
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td style={{ padding: "10px 12px" }}>
                          <div
                            style={{
                              fontFamily: "var(--font-dm-sans)",
                              fontSize: "0.8rem",
                              color: "var(--navy)",
                            }}
                          >
                            {ban.email ?? "—"}
                          </div>
                          {ban.ip_hash && (
                            <div
                              style={{
                                fontFamily: "var(--font-jetbrains)",
                                fontSize: "0.6rem",
                                color: "var(--ink-m)",
                              }}
                            >
                              ip: {ban.ip_hash}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontFamily: "var(--font-dm-sans)",
                            fontSize: "0.8rem",
                            color: "var(--ink-m)",
                          }}
                        >
                          {ban.reason ?? "—"}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontFamily: "var(--font-jetbrains)",
                            fontSize: "0.65rem",
                            color: "var(--ink-m)",
                          }}
                        >
                          {ban.banned_by ?? "—"}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontFamily: "var(--font-jetbrains)",
                            fontSize: "0.65rem",
                            color: "var(--ink-m)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(ban.created_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {ban.expires_at && (
                            <div>
                              exp:{" "}
                              {new Date(ban.expires_at).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <button
                            onClick={() => handleUnban(ban.id)}
                            style={{
                              background: "none",
                              border: "1px solid var(--border)",
                              color: "var(--ink-m)",
                              fontFamily: "var(--font-jetbrains)",
                              fontSize: "0.6rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              padding: "3px 8px",
                              cursor: "pointer",
                            }}
                          >
                            Unban
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
