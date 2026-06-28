"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Send, RefreshCw, X, ChevronDown, ChevronRight,
  Edit2, Clock, BarChart2, Plus, Zap, AlertCircle,
  Eye, CheckCircle, XCircle,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";
import { client as sanityClient } from "@/app/lib/sanity";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueuePost {
  id: string;
  article_id: string;
  article_slug: string;
  article_headline: string;
  platform: string;
  content: string;
  hashtags: string[];
  image_url: string | null;
  article_url: string;
  scheduled_for: string;
  status: string;
  buffer_post_id: string | null;
  sent_at: string | null;
  error: string | null;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  analytics_fetched_at: string | null;
  pillar: string | null;
  created_at: string;
  review_score: number | null;
  review_passed: boolean | null;
  review_notes: string | null;
}

interface ArticleOption {
  _id: string;
  title: string;
  slug: { current: string };
  pillar?: { name: string; slug: { current: string } };
}

interface PreviewReview {
  score: number; passed: boolean;
  toneScore: number; accuracyScore: number; hookScore: number;
  satireScore: number; originalityScore: number;
  notes: string; revisionsRequired: string[];
}

interface PreviewPost {
  content: string; hashtags: string[]; charCount: number;
  imageUrl: string | null; estimatedSlot: string;
  review: PreviewReview | null;
  validations: {
    hooksBeforeFold?: boolean; hookLength?: number; endsWithQuestion?: boolean;
    underCharLimit?: boolean; charCount?: number; remaining?: number;
    hasImage?: boolean; hasLinkInBio?: boolean;
  };
}

interface PreviewResult {
  article: { headline: string; pillar: string; articleUrl: string };
  posts: { linkedin?: PreviewPost; twitter?: PreviewPost; instagram?: PreviewPost };
  totalMs: number;
}

type PlatformFilter = "all" | "linkedin" | "twitter" | "instagram";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  linkedin:  { label: "LinkedIn",   color: "#0077b5", bg: "#e8f4fd" },
  twitter:   { label: "Twitter/X",  color: "#111",    bg: "#f0f0f0" },
  instagram: { label: "Instagram",  color: "#c13584", bg: "#fce4ec" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_approval: { label: "Awaiting approval", color: "#92400e", bg: "#fef3c7" },
  pending:          { label: "Pending",            color: "#b45309", bg: "#fffbeb" },
  sending:          { label: "Sending…",           color: "#1d4ed8", bg: "#eff6ff" },
  sent:             { label: "Sent",               color: "#15803d", bg: "#f0fdf4" },
  failed:           { label: "Failed",             color: "#b91c1c", bg: "#fef2f2" },
  cancelled:        { label: "Cancelled",          color: "#6b7280", bg: "#f9fafb" },
};

const PILLAR_COLORS: Record<string, string> = {
  "markets-floor":  "#1d4ed8",
  "macro-mondays":  "#15803d",
  "c-suite-circus": "#7c3aed",
  "global-office":  "#b45309",
  "water-cooler":   "#be123c",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function engRate(post: QueuePost): number {
  if (!post.impressions || post.impressions === 0) return 0;
  return ((post.likes + post.comments + post.shares) / post.impressions) * 100;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div className="p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-3xl font-serif font-bold mb-1" style={{ color: "var(--navy)" }}>{value}</div>
      <div className="text-xs font-sans font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--ink-m)" }}>{label}</div>
      {sub && <div className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>{sub}</div>}
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const cfg = PLATFORM_CONFIG[platform] ?? { label: platform, color: "#666", bg: "#f5f5f5" };
  return (
    <span className="text-xs font-sans font-semibold px-2 py-0.5"
      style={{ color: cfg.color, background: cfg.bg, borderRadius: 2 }}>
      {cfg.label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#666", bg: "#f5f5f5" };
  return (
    <span className="text-xs font-mono px-2 py-0.5"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33`, borderRadius: 2 }}>
      {cfg.label}
    </span>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onUpdated,
  onApprove,
  onReject,
  onQueueBuffer,
  onPostLive,
}: {
  post: QueuePost;
  onUpdated: (updated: QueuePost | null) => void;
  onApprove?: () => void;
  onReject?: () => void;
  onQueueBuffer?: () => Promise<void>;
  onPostLive?: () => Promise<void>;
}) {
  const [expanded, setExpanded]           = useState(false);
  const [editing, setEditing]             = useState(false);
  const [editContent, setEditContent]     = useState(post.content);
  const [rescheduling, setRescheduling]   = useState(false);
  const [newTime, setNewTime]             = useState("");
  const [busy, setBusy]                   = useState(false);
  const pillarColor = PILLAR_COLORS[post.pillar ?? ""] ?? "var(--border)";

  async function patch(updates: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/social/queue/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json() as { post?: QueuePost };
      if (res.ok && data.post) onUpdated(data.post);
    } finally {
      setBusy(false);
    }
  }

  async function handleRetry() {
    setBusy(true);
    try {
      const res = await fetch(`/api/social/queue/${post.id}/retry`, { method: "POST" });
      const data = await res.json() as { post?: QueuePost };
      if (res.ok && data.post) onUpdated(data.post);
    } finally {
      setBusy(false);
    }
  }

  async function handleQueueBufferClick() {
    if (!onQueueBuffer) return;
    setBusy(true);
    try { await onQueueBuffer(); } finally { setBusy(false); }
  }

  async function handlePostLiveClick() {
    if (!onPostLive) return;
    setBusy(true);
    try { await onPostLive(); } finally { setBusy(false); }
  }

  async function handleSaveEdit() {
    await patch({ content: editContent });
    setEditing(false);
  }

  async function handleCancel() {
    if (!confirm("Cancel this scheduled post?")) return;
    await patch({ status: "cancelled" });
  }

  async function handleReschedule() {
    if (!newTime) return;
    await patch({ scheduled_for: new Date(newTime).toISOString() });
    setRescheduling(false);
    setNewTime("");
  }

  const preview = post.content.slice(0, 120) + (post.content.length > 120 ? "…" : "");
  const canAct = post.status === "pending_approval" || post.status === "pending" || post.status === "failed";

  return (
    <div className="mb-3" style={{
      border: "1px solid var(--border)",
      borderLeft: `4px solid ${pillarColor}`,
      background: "var(--surface)",
    }}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <PlatformBadge platform={post.platform} />
          <span className="text-xs font-mono" style={{ color: "var(--ink-m)" }}>
            <Clock className="inline w-3 h-3 mr-1" />{formatTime(post.scheduled_for)}
          </span>
          <StatusPill status={post.status} />
          {post.review_score !== null && post.review_score !== undefined && (
            <span className="text-xs font-mono px-1.5 py-0.5"
              style={{
                background: post.review_passed ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${post.review_passed ? "#bbf7d0" : "#fecaca"}`,
                color: post.review_passed ? "#15803d" : "#b91c1c",
                borderRadius: 2,
              }}
              title={post.review_notes ?? undefined}>
              {post.review_score}/10
            </span>
          )}
          {post.pillar && (
            <span className="text-xs font-mono ml-auto" style={{ color: pillarColor }}>{post.pillar}</span>
          )}
        </div>

        {/* Headline */}
        <div className="text-sm font-sans font-semibold mb-2" style={{ color: "var(--ink)" }}>
          {post.article_headline}
        </div>

        {/* Content preview / edit */}
        {editing ? (
          <div className="mb-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={6}
              className="w-full text-sm font-sans p-3 resize-none"
              style={{ border: "1px solid var(--border)", background: "var(--cream)", color: "var(--ink)" }}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={handleSaveEdit} disabled={busy}
                className="text-xs font-sans font-semibold px-3 py-1.5 flex items-center gap-1"
                style={{ background: "var(--navy)", color: "#fff", borderRadius: 2 }}>
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Save
              </button>
              <button onClick={() => { setEditing(false); setEditContent(post.content); }}
                className="text-xs font-sans px-3 py-1.5"
                style={{ border: "1px solid var(--border)", borderRadius: 2 }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-2">
            <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>
              {expanded ? post.content : preview}
            </p>
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs mt-1"
              style={{ color: "var(--navy)" }}>
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {expanded ? "Collapse" : "Expand"}
            </button>
          </div>
        )}

        {/* Hashtags */}
        {post.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {post.hashtags.map((tag) => (
              <span key={tag} className="text-xs font-mono px-1.5 py-0.5"
                style={{ background: "var(--cream)", border: "1px solid var(--border)", color: "var(--ink-m)" }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Error message */}
        {post.status === "failed" && post.error && (
          <div className="flex items-start gap-2 text-xs p-2 mb-3"
            style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 2 }}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {post.error}
          </div>
        )}

        {/* Reschedule panel */}
        {rescheduling && (
          <div className="flex items-center gap-2 mb-3">
            <input type="datetime-local" value={newTime} onChange={(e) => setNewTime(e.target.value)}
              className="text-xs font-mono p-1.5 border"
              style={{ border: "1px solid var(--border)", background: "var(--cream)", color: "var(--ink)" }} />
            <button onClick={handleReschedule} disabled={!newTime || busy}
              className="text-xs font-sans font-semibold px-3 py-1.5"
              style={{ background: "var(--navy)", color: "#fff", borderRadius: 2, opacity: !newTime || busy ? 0.5 : 1 }}>
              Confirm
            </button>
            <button onClick={() => setRescheduling(false)} className="text-xs" style={{ color: "var(--ink-m)" }}>Cancel</button>
          </div>
        )}

        {/* Action buttons */}
        {canAct && !editing && (
          <div className="flex items-center gap-2 flex-wrap">
            {post.status === "pending_approval" && (
              <>
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-xs font-sans px-2.5 py-1.5"
                  style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)" }}>
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button onClick={handleQueueBufferClick} disabled={busy || !onQueueBuffer}
                  className="flex items-center gap-1 text-xs font-sans font-semibold px-3 py-1.5"
                  style={{ background: "#1d4ed8", color: "#fff", borderRadius: 2, opacity: !onQueueBuffer || busy ? 0.5 : 1 }}>
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                  Queue to Buffer
                </button>
                <button onClick={handlePostLiveClick} disabled={busy || !onPostLive}
                  className="flex items-center gap-1 text-xs font-sans font-semibold px-3 py-1.5"
                  style={{ background: "#15803d", color: "#fff", borderRadius: 2, opacity: !onPostLive || busy ? 0.5 : 1 }}>
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Post live
                </button>
                <button onClick={onReject} disabled={busy || !onReject}
                  className="flex items-center gap-1 text-xs font-sans px-2.5 py-1.5 ml-auto"
                  style={{ color: "#b91c1c" }}>
                  <X className="w-3 h-3" /> Reject
                </button>
              </>
            )}
            {post.status === "pending" && (
              <>
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-xs font-sans px-2.5 py-1.5"
                  style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)" }}>
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button onClick={handleQueueBufferClick} disabled={busy || !onQueueBuffer}
                  className="flex items-center gap-1 text-xs font-sans font-semibold px-3 py-1.5"
                  style={{ background: "#1d4ed8", color: "#fff", borderRadius: 2, opacity: !onQueueBuffer || busy ? 0.5 : 1 }}>
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                  Queue to Buffer
                </button>
                <button onClick={handlePostLiveClick} disabled={busy || !onPostLive}
                  className="flex items-center gap-1 text-xs font-sans font-semibold px-3 py-1.5"
                  style={{ background: "#15803d", color: "#fff", borderRadius: 2, opacity: !onPostLive || busy ? 0.5 : 1 }}>
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Post live
                </button>
                <button onClick={() => setRescheduling(!rescheduling)}
                  className="flex items-center gap-1 text-xs font-sans px-2.5 py-1.5"
                  style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)" }}>
                  <RefreshCw className="w-3 h-3" /> Reschedule
                </button>
                <button onClick={handleCancel} disabled={busy}
                  className="flex items-center gap-1 text-xs font-sans px-2.5 py-1.5 ml-auto"
                  style={{ color: "#b91c1c" }}>
                  <X className="w-3 h-3" /> Cancel
                </button>
              </>
            )}
            {post.status === "failed" && (
              <button onClick={handleRetry} disabled={busy}
                className="flex items-center gap-1 text-xs font-sans font-semibold px-3 py-1.5"
                style={{ background: "#1d4ed8", color: "#fff", borderRadius: 2 }}>
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Retry (+15 min)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── PerformanceTable ──────────────────────────────────────────────────────────

function PerformanceTable({ posts }: { posts: QueuePost[] }) {
  const rows = posts
    .filter((p) => p.analytics_fetched_at !== null)
    .sort((a, b) => engRate(b) - engRate(a));

  if (rows.length === 0) {
    return (
      <div className="text-sm font-sans py-6 text-center" style={{ color: "var(--ink-m)" }}>
        No analytics yet — data is collected 24 hours after posting.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="w-full text-xs font-sans" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--border)" }}>
            {["Date", "Platform", "Article", "Impressions", "Likes", "Shares", "Clicks", "Eng. Rate"].map((h) => (
              <th key={h} className="text-left py-2 px-3 font-semibold uppercase tracking-wider"
                style={{ color: "var(--ink-m)", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="py-2 px-3 font-mono" style={{ color: "var(--ink-m)" }}>{formatDate(p.sent_at ?? p.scheduled_for)}</td>
              <td className="py-2 px-3"><PlatformBadge platform={p.platform} /></td>
              <td className="py-2 px-3 max-w-xs truncate" style={{ color: "var(--ink)" }} title={p.article_headline}>
                {p.article_headline}
              </td>
              <td className="py-2 px-3 font-mono text-right">{p.impressions.toLocaleString()}</td>
              <td className="py-2 px-3 font-mono text-right">{p.likes.toLocaleString()}</td>
              <td className="py-2 px-3 font-mono text-right">{p.shares.toLocaleString()}</td>
              <td className="py-2 px-3 font-mono text-right">{p.clicks.toLocaleString()}</td>
              <td className="py-2 px-3 font-mono text-right font-bold"
                style={{ color: engRate(p) >= 3 ? "#15803d" : engRate(p) >= 1 ? "#b45309" : "var(--ink)" }}>
                {engRate(p).toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── PreviewCard ───────────────────────────────────────────────────────────────

function tick(ok: boolean, label: string) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-sans">
      {ok
        ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#15803d" }} />
        : <XCircle    className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#b91c1c" }} />}
      <span style={{ color: ok ? "#15803d" : "#b91c1c" }}>{label}</span>
    </div>
  );
}

function PreviewCard({ platform, post }: { platform: string; post: PreviewPost }) {
  const cfg = PLATFORM_CONFIG[platform] ?? { label: platform, color: "#666", bg: "#f5f5f5" };
  const charLimit = platform === "twitter" ? 215 : platform === "linkedin" ? 3000 : 2200;
  const overLimit = post.charCount > charLimit;
  const { validations: v } = post;

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--surface)" }} className="flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)", background: cfg.bg }}>
        <span className="text-sm font-sans font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
        <span className="text-xs font-mono font-semibold"
          style={{ color: overLimit ? "#b91c1c" : "#15803d" }}>
          {post.charCount}/{charLimit}
        </span>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Content */}
        <pre className="text-xs font-sans whitespace-pre-wrap leading-relaxed select-text m-0"
          style={{ color: "var(--ink)", background: "var(--cream)", padding: "10px", border: "1px solid var(--border)", borderRadius: 2 }}>
          {post.content}
        </pre>

        {/* Hashtags */}
        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.hashtags.map((t) => (
              <span key={t} className="text-xs font-mono px-1.5 py-0.5"
                style={{ background: "var(--cream)", border: "1px solid var(--border)", color: "var(--ink-m)" }}>
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Validations */}
        <div className="space-y-1">
          {platform === "linkedin" && (
            <>
              {tick(v.hooksBeforeFold ?? false, `Hook before fold (${v.hookLength ?? 0} chars)`)}
              {tick(v.endsWithQuestion ?? false, "Ends with question")}
            </>
          )}
          {platform === "twitter" && tick(v.underCharLimit ?? false, `${v.charCount ?? 0}/215 chars (${v.remaining ?? 0} remaining)`)}
          {platform === "instagram" && (
            <>
              {tick(v.hasImage ?? false, "Image attached")}
              {tick(v.hasLinkInBio ?? false, "Link in bio text present")}
            </>
          )}
        </div>

        {/* Review */}
        {post.review && (
          <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-sans font-semibold" style={{ color: "var(--ink-m)" }}>Editor review</span>
              <span className="text-xs font-mono font-bold px-1.5 py-0.5"
                style={{
                  background: post.review.passed ? "#dcfce7" : "#fef2f2",
                  color:      post.review.passed ? "#15803d" : "#b91c1c",
                  border:     `1px solid ${post.review.passed ? "#86efac" : "#fecaca"}`,
                }}>
                {post.review.score}/10 {post.review.passed ? "PASS" : "FAIL"}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1 mb-2">
              {([["Tone", post.review.toneScore], ["Accuracy", post.review.accuracyScore], ["Hook", post.review.hookScore], ["Satire", post.review.satireScore], ["Original", post.review.originalityScore]] as [string, number][]).map(([label, score]) => (
                <div key={label} className="text-center">
                  <div className="text-xs font-mono font-bold" style={{ color: score >= 7 ? "#15803d" : "#b91c1c" }}>{score}</div>
                  <div className="font-sans" style={{ color: "var(--ink-m)", fontSize: "10px" }}>{label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs font-sans leading-relaxed" style={{ color: "var(--ink-m)" }}>{post.review.notes}</p>
            {post.review.revisionsRequired.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {post.review.revisionsRequired.map((r, i) => (
                  <li key={i} className="text-xs font-sans" style={{ color: "#b45309" }}>· {r}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Next slot */}
        <div className="text-xs font-mono mt-auto" style={{ color: "var(--ink-m)" }}>
          Next slot: {new Date(post.estimatedSlot).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" })} UTC
        </div>
      </div>
    </div>
  );
}

// ── ManualComposer ────────────────────────────────────────────────────────────

function ManualComposer({
  articles,
  onAdded,
}: {
  articles: ArticleOption[];
  onAdded: (post: QueuePost) => void;
}) {
  const [platform, setPlatform]       = useState<"linkedin" | "twitter" | "instagram">("linkedin");
  const [articleId, setArticleId]     = useState("");
  const [content, setContent]         = useState("");
  const [hashtags, setHashtags]       = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [generating, setGenerating]   = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [genError, setGenError]       = useState("");
  const [reviewScore, setReviewScore]   = useState<number | null>(null);
  const [reviewPassed, setReviewPassed] = useState<boolean | null>(null);
  const [reviewNotes, setReviewNotes]   = useState<string | null>(null);

  async function handleGenerate() {
    if (!articleId) return;
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/social/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, platform }),
      });
      const data = await res.json() as { content?: string; hashtags?: string[]; error?: string; reviewScore?: number | null; reviewPassed?: boolean | null; reviewNotes?: string | null };
      if (!res.ok) { setGenError(data.error ?? "Generation failed"); return; }
      setContent(data.content ?? "");
      setHashtags((data.hashtags ?? []).join(", "));
      setReviewScore(data.reviewScore ?? null);
      setReviewPassed(data.reviewPassed ?? null);
      setReviewNotes(data.reviewNotes ?? null);
    } catch {
      setGenError("Network error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit() {
    if (!articleId || !content || !scheduledFor) return;
    const article = articles.find((a) => a._id === articleId);
    if (!article) return;

    setSubmitting(true);
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
      const res = await fetch("/api/social/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_id:       article._id,
          article_slug:     article.slug.current,
          article_headline: article.title,
          platform,
          content,
          hashtags:         hashtags.split(",").map((h) => h.trim()).filter(Boolean),
          article_url:      `${siteUrl}/${article.pillar?.slug?.current ?? ""}/${article.slug.current}`,
          scheduled_for:    new Date(scheduledFor).toISOString(),
          pillar:           article.pillar?.slug?.current ?? null,
        }),
      });
      const data = await res.json() as { post?: QueuePost };
      if (res.ok && data.post) {
        onAdded(data.post);
        setContent("");
        setHashtags("");
        setScheduledFor("");
        setArticleId("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--border)",
    background: "var(--cream)",
    color: "var(--ink)",
    fontFamily: "var(--font-dm-sans)",
    fontSize: "0.85rem",
    borderRadius: 2,
  };

  return (
    <div className="p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-sm font-sans font-semibold mb-4" style={{ color: "var(--ink)" }}>
        <Plus className="inline w-4 h-4 mr-1" />
        Manual post composer
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Platform */}
        <div>
          <label className="block text-xs font-sans font-semibold mb-1" style={{ color: "var(--ink-m)" }}>Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} style={inputStyle}>
            <option value="linkedin">LinkedIn</option>
            <option value="twitter">Twitter/X</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>

        {/* Article picker */}
        <div>
          <label className="block text-xs font-sans font-semibold mb-1" style={{ color: "var(--ink-m)" }}>Article</label>
          <select value={articleId} onChange={(e) => setArticleId(e.target.value)} style={inputStyle}>
            <option value="">— pick an article —</option>
            {articles.map((a) => (
              <option key={a._id} value={a._id}>{a.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Generate button */}
      <div className="mt-3 flex items-center gap-3">
        <button onClick={handleGenerate} disabled={!articleId || generating}
          className="flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-2"
          style={{ background: "var(--navy)", color: "#fff", borderRadius: 2, opacity: !articleId || generating ? 0.5 : 1 }}>
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Generate draft with AI
        </button>
        {genError && <span className="text-xs" style={{ color: "#b91c1c" }}>{genError}</span>}
      </div>

      {/* Content */}
      <div className="mt-3">
        <label className="block text-xs font-sans font-semibold mb-1" style={{ color: "var(--ink-m)" }}>Post content</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5}
          placeholder="Write or generate post content…"
          className="resize-none" style={{ ...inputStyle }} />
      </div>

      {/* Review result */}
      {reviewScore !== null && (
        <div className="flex items-start gap-3 mt-3 p-3 text-xs font-sans"
          style={{
            background: reviewPassed ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${reviewPassed ? "#bbf7d0" : "#fecaca"}`,
            borderRadius: 2,
          }}>
          <span className="font-semibold shrink-0" style={{ color: reviewPassed ? "#15803d" : "#b91c1c" }}>
            AI review: {reviewScore}/10 {reviewPassed ? "✓ Passed" : "✗ Failed"}
          </span>
          {reviewNotes && <span style={{ color: "var(--ink-m)" }}>{reviewNotes}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 mt-3 md:grid-cols-2">
        {/* Hashtags */}
        <div>
          <label className="block text-xs font-sans font-semibold mb-1" style={{ color: "var(--ink-m)" }}>Hashtags (comma-separated, no #)</label>
          <input type="text" value={hashtags} onChange={(e) => setHashtags(e.target.value)}
            placeholder="business, finance" style={inputStyle} />
        </div>

        {/* Schedule time */}
        <div>
          <label className="block text-xs font-sans font-semibold mb-1" style={{ color: "var(--ink-m)" }}>Schedule time</label>
          <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <button onClick={handleSubmit} disabled={!articleId || !content || !scheduledFor || submitting}
        className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2 mt-4"
        style={{
          background: "var(--navy)", color: "#fff", borderRadius: 2,
          opacity: !articleId || !content || !scheduledFor || submitting ? 0.5 : 1,
        }}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Add to queue
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SocialDashboard() {
  const router = useRouter();

  const [authed, setAuthed]               = useState<boolean | null>(null);
  const [loading, setLoading]             = useState(true);
  const [todayPosts, setTodayPosts]       = useState<QueuePost[]>([]);
  const [weekPosts, setWeekPosts]         = useState<QueuePost[]>([]);
  const [articles, setArticles]           = useState<ArticleOption[]>([]);
  const [platform, setPlatform]           = useState<PlatformFilter>("all");
  const [generating, setGenerating]       = useState(false);
  const [generateMsg, setGenerateMsg]     = useState("");
  const [approvingAll, setApprovingAll]   = useState(false);
  const [queueingAll, setQueueingAll]     = useState(false);
  const [postingLiveAll, setPostingLiveAll] = useState(false);
  const [previewArticleId, setPreviewArticleId] = useState("");
  const [preview, setPreview]                   = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading]     = useState(false);
  const [autoPostEnabled, setAutoPostEnabled]   = useState(false);
  const [autoPostToggling, setAutoPostToggling] = useState(false);

  // Auth check
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else setAuthed(true);
    });
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, weekRes, articlesRes, settingsRes] = await Promise.all([
        fetch("/api/social/queue?date=today"),
        fetch("/api/social/queue?date=7days"),
        fetch("/api/editorial/review").then(async (r) => {
          // Pull recent articles from the digest for the composer picker
          if (!r.ok) return { articles: [] };
          const d = await r.json() as { digest?: { articles?: { draft: { headline?: string; featuredImage?: unknown } }[] } };
          return d;
        }),
        fetch("/api/social/settings"),
      ]);

      if (todayRes.ok) {
        const d = await todayRes.json() as { posts: QueuePost[] };
        setTodayPosts(d.posts ?? []);
      }
      if (weekRes.ok) {
        const d = await weekRes.json() as { posts: QueuePost[] };
        setWeekPosts(d.posts ?? []);
      }

      if (settingsRes.ok) {
        const d = await settingsRes.json() as { auto_post_enabled?: boolean };
        setAutoPostEnabled(d.auto_post_enabled ?? false);
      }

      // Fetch recent Sanity articles for the composer
      if (sanityClient) {
        const articles = await sanityClient.fetch<ArticleOption[]>(
          `*[_type=="article"]|order(publishedAt desc)[0...20]{_id,title,slug,pillar->{name,slug}}`
        );
        setArticles(articles ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  async function handlePreview() {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const url = `/api/social/preview${previewArticleId ? `?articleId=${previewArticleId}` : ""}`;
      const res = await fetch(url);
      if (res.ok) setPreview(await res.json() as PreviewResult);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleToggleAutoPost() {
    setAutoPostToggling(true);
    try {
      const res = await fetch("/api/social/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_post_enabled: !autoPostEnabled }),
      });
      const data = await res.json() as { auto_post_enabled?: boolean };
      if (res.ok) setAutoPostEnabled(data.auto_post_enabled ?? !autoPostEnabled);
    } finally {
      setAutoPostToggling(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateMsg("");
    try {
      const res = await fetch("/api/social/generate", { method: "POST" });
      const d = await res.json() as { postsGenerated?: number; postsAutoPosted?: number; message?: string };
      const autoPosted = d.postsAutoPosted ?? 0;
      setGenerateMsg(
        d.message ??
        (autoPosted > 0
          ? `Generated ${d.postsGenerated ?? 0} posts · ${autoPosted} auto-posted`
          : `Generated ${d.postsGenerated ?? 0} posts`)
      );
      await fetchData();
    } catch {
      setGenerateMsg("Failed to generate posts");
    } finally {
      setGenerating(false);
    }
  }

  function handlePostUpdated(updated: QueuePost | null, oldId: string) {
    const replace = (prev: QueuePost[]) =>
      updated ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev.filter((p) => p.id !== oldId);
    setTodayPosts(replace);
    setWeekPosts(replace);
  }

  async function handleApprove(id: string) {
    const res = await fetch(`/api/social/queue/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
    });
    const data = await res.json() as { post?: QueuePost };
    if (res.ok && data.post) handlePostUpdated(data.post, id);
  }

  async function handleQueueBuffer(id: string) {
    const res = await fetch(`/api/social/queue/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "scheduled" }),
    });
    const data = await res.json() as { post?: QueuePost; error?: string };
    if (res.ok && data.post) handlePostUpdated(data.post, id);
    else if (data.error) alert(`Buffer error: ${data.error}`);
  }

  async function handlePostLive(id: string) {
    const res = await fetch(`/api/social/queue/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "now" }),
    });
    const data = await res.json() as { post?: QueuePost; error?: string };
    if (res.ok && data.post) handlePostUpdated(data.post, id);
    else if (data.error) alert(`Buffer error: ${data.error}`);
  }

  async function handleReject(id: string) {
    const res = await fetch(`/api/social/queue/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const data = await res.json() as { post?: QueuePost };
    if (res.ok && data.post) handlePostUpdated(data.post, id);
  }

  async function handleApproveAll() {
    setApprovingAll(true);
    try {
      await fetch("/api/social/queue/approve-all", { method: "POST" });
      await fetchData();
    } finally {
      setApprovingAll(false);
    }
  }

  async function handleQueueAll() {
    setQueueingAll(true);
    try {
      const res = await fetch("/api/social/queue/bulk-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "scheduled" }),
      });
      const d = await res.json() as { sent?: number; failed?: number; error?: string };
      if (!res.ok) { alert(`Queue all failed: ${d.error}`); return; }
      setGenerateMsg(`Queued ${d.sent ?? 0} posts to Buffer${d.failed ? ` · ${d.failed} failed` : ""}`);
      await fetchData();
    } catch {
      alert("Network error queuing posts");
    } finally {
      setQueueingAll(false);
    }
  }

  async function handlePostLiveAll() {
    const pendingCount = weekPosts.filter((p) => p.status === "pending_approval").length;
    if (!confirm(`Post all ${pendingCount} pending posts live to Buffer right now?`)) return;
    setPostingLiveAll(true);
    try {
      const res = await fetch("/api/social/queue/bulk-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "now" }),
      });
      const d = await res.json() as { sent?: number; failed?: number; error?: string };
      if (!res.ok) { alert(`Post live all failed: ${d.error}`); return; }
      setGenerateMsg(`Posted ${d.sent ?? 0} live${d.failed ? ` · ${d.failed} failed` : ""}`);
      await fetchData();
    } catch {
      alert("Network error posting live");
    } finally {
      setPostingLiveAll(false);
    }
  }

  function handlePostAdded(post: QueuePost) {
    const today = new Date().toISOString().split("T")[0];
    if (post.scheduled_for.startsWith(today)) {
      setTodayPosts((prev) => [...prev, post].sort((a, b) =>
        a.scheduled_for.localeCompare(b.scheduled_for)
      ));
    }
  }

  if (authed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--navy)" }} />
      </div>
    );
  }

  // Derived
  const approvalPosts = weekPosts.filter((p) => p.status === "pending_approval");
  const sentToday = todayPosts.filter((p) => p.status === "sent").length;
  const scheduledToday = todayPosts.filter((p) => p.status === "pending").length;
  const sentThisWeek = weekPosts.filter((p) => p.status === "sent").length;
  const withAnalytics = weekPosts.filter((p) => p.analytics_fetched_at !== null);
  const avgEng = withAnalytics.length
    ? (withAnalytics.reduce((sum, p) => sum + engRate(p), 0) / withAnalytics.length).toFixed(2)
    : "—";

  // Filtered queue
  const filtered = platform === "all"
    ? todayPosts
    : todayPosts.filter((p) => p.platform === platform);

  const TABS: { key: PlatformFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "twitter", label: "Twitter/X" },
    { key: "instagram", label: "Instagram" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold" style={{ color: "var(--navy)" }}>Social media</h1>
            <p className="text-sm font-sans mt-1" style={{ color: "var(--ink-m)" }}>
              Schedule · Publish · Analyse
            </p>
          </div>
          <div className="flex items-center gap-3">
            {generateMsg && (
              <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>{generateMsg}</span>
            )}
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-1.5 text-sm font-sans px-3 py-2"
              style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)" }}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleToggleAutoPost}
              disabled={autoPostToggling}
              title={autoPostEnabled ? "Auto-post on: posts scoring ≥ 7 go live automatically" : "Auto-post off: all posts require manual approval"}
              className="flex items-center gap-2 text-sm font-sans px-3 py-2"
              style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)", background: "var(--surface)" }}>
              {autoPostToggling
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--ink-m)" }} />
                : <Zap className="w-3.5 h-3.5" style={{ color: autoPostEnabled ? "#15803d" : "var(--ink-m)" }} />}
              <span className="text-xs font-sans">Auto-post</span>
              <span style={{
                width: 34, height: 18, borderRadius: 9, flexShrink: 0, position: "relative", display: "inline-flex",
                background: autoPostEnabled ? "#15803d" : "#d1d5db", transition: "background 0.2s",
              }}>
                <span style={{
                  position: "absolute", top: 2, left: autoPostEnabled ? 16 : 2,
                  width: 14, height: 14, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                }} />
              </span>
            </button>
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2"
              style={{ background: "var(--navy)", color: "#fff", borderRadius: 2 }}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Generate today&apos;s posts
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard value={approvalPosts.length} label="Awaiting approval" />
          <StatCard value={sentToday} label="Sent today" />
          <StatCard value={sentThisWeek} label="Sent this week" />
          <StatCard value={`${avgEng}%`} label="Avg engagement" sub="last 7 days" />
        </div>

        {/* Awaiting Approval */}
        {approvalPosts.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-serif font-bold flex items-center gap-2" style={{ color: "#92400e" }}>
                <AlertCircle className="w-5 h-5" />
                Awaiting approval ({approvalPosts.length})
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={handleApproveAll} disabled={approvingAll || queueingAll || postingLiveAll}
                  className="flex items-center gap-1.5 text-sm font-sans font-semibold px-3 py-2"
                  style={{ border: "1px solid #15803d", color: "#15803d", borderRadius: 2, background: "var(--surface)", opacity: approvingAll ? 0.6 : 1 }}>
                  {approvingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Approve all
                </button>
                <button onClick={handleQueueAll} disabled={queueingAll || approvingAll || postingLiveAll}
                  className="flex items-center gap-1.5 text-sm font-sans font-semibold px-3 py-2"
                  style={{ background: "#1d4ed8", color: "#fff", borderRadius: 2, opacity: queueingAll ? 0.6 : 1 }}>
                  {queueingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  Queue all
                </button>
                <button onClick={handlePostLiveAll} disabled={postingLiveAll || approvingAll || queueingAll}
                  className="flex items-center gap-1.5 text-sm font-sans font-semibold px-3 py-2"
                  style={{ background: "#15803d", color: "#fff", borderRadius: 2, opacity: postingLiveAll ? 0.6 : 1 }}>
                  {postingLiveAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Post live all
                </button>
              </div>
            </div>
            <div className="p-3 mb-4 text-xs font-sans"
              style={{ background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e", borderRadius: 2 }}>
              These posts were auto-generated and are waiting for your approval before they go live.
              Review each post, edit if needed, then approve — or reject to discard.
            </div>
            {approvalPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onUpdated={(updated) => handlePostUpdated(updated, post.id)}
                onApprove={() => handleApprove(post.id)}
                onReject={() => handleReject(post.id)}
                onQueueBuffer={() => handleQueueBuffer(post.id)}
                onPostLive={() => handlePostLive(post.id)}
              />
            ))}
          </section>
        )}

        {/* Platform tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPlatform(tab.key)}
              className="text-sm font-sans px-4 py-1.5"
              style={{
                borderRadius: 2,
                border: "1px solid var(--border)",
                background: platform === tab.key ? "var(--navy)" : "var(--surface)",
                color: platform === tab.key ? "#fff" : "var(--ink)",
                fontWeight: platform === tab.key ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Today's queue */}
        <section className="mb-10">
          <h2 className="text-lg font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>
            Today&apos;s queue
          </h2>
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-28 rounded" style={{ background: "var(--surface)" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm font-sans py-8 text-center" style={{ color: "var(--ink-m)" }}>
              No posts scheduled for today on this platform.
            </div>
          ) : (
            filtered.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onUpdated={(updated) => handlePostUpdated(updated, post.id)}
                onApprove={() => handleApprove(post.id)}
                onReject={() => handleReject(post.id)}
                onQueueBuffer={() => handleQueueBuffer(post.id)}
                onPostLive={() => handlePostLive(post.id)}
              />
            ))
          )}
        </section>

        {/* Performance table */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5" style={{ color: "var(--navy)" }} />
            <h2 className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>
              Performance — last 7 days
            </h2>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)" }} className="p-4">
            <PerformanceTable posts={weekPosts} />
          </div>
        </section>

        {/* Content preview */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5" style={{ color: "var(--navy)" }} />
            <h2 className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>
              Content preview
            </h2>
          </div>

          <div className="flex gap-3 mb-4 flex-wrap">
            <select
              value={previewArticleId}
              onChange={(e) => setPreviewArticleId(e.target.value)}
              className="text-sm font-sans p-2 flex-1 min-w-0"
              style={{ border: "1px solid var(--border)", background: "var(--cream)", color: "var(--ink)", borderRadius: 2 }}>
              <option value="">Most recent article</option>
              {articles.map((a) => (
                <option key={a._id} value={a._id}>
                  [{a.pillar?.name ?? ""}] {a.title}
                </option>
              ))}
            </select>
            <button onClick={handlePreview} disabled={previewLoading}
              className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2"
              style={{ background: "var(--navy)", color: "#fff", borderRadius: 2, opacity: previewLoading ? 0.6 : 1 }}>
              {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Generate previews
            </button>
          </div>

          {preview && (
            <>
              <div className="text-xs font-mono mb-3 flex gap-4 flex-wrap" style={{ color: "var(--ink-m)" }}>
                <span><strong style={{ color: "var(--ink)" }}>{preview.article.headline}</strong></span>
                <span>{preview.totalMs}ms</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["linkedin", "twitter", "instagram"] as const).map((p) =>
                  preview.posts[p] ? (
                    <PreviewCard key={p} platform={p} post={preview.posts[p]!} />
                  ) : null
                )}
              </div>
            </>
          )}
        </section>

        {/* Manual composer */}
        <section>
          <h2 className="text-lg font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>
            Manual post composer
          </h2>
          <ManualComposer articles={articles} onAdded={handlePostAdded} />
        </section>

      </div>
    </div>
  );
}
