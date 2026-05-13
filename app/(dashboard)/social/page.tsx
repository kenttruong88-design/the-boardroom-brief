"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Send, RefreshCw, X, ChevronDown, ChevronRight,
  Edit2, Clock, BarChart2, Plus, Zap, AlertCircle,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

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
}

interface ArticleOption {
  _id: string;
  title: string;
  slug: { current: string };
  pillar?: { name: string; slug: { current: string } };
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
}: {
  post: QueuePost;
  onUpdated: (updated: QueuePost | null) => void;
  onApprove?: () => void;
  onReject?: () => void;
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
                <button onClick={onApprove} disabled={busy || !onApprove}
                  className="flex items-center gap-1 text-xs font-sans font-semibold px-3 py-1.5"
                  style={{ background: "#15803d", color: "#fff", borderRadius: 2 }}>
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Approve
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
                <button onClick={() => setRescheduling(!rescheduling)}
                  className="flex items-center gap-1 text-xs font-sans px-2.5 py-1.5"
                  style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)" }}>
                  <Clock className="w-3 h-3" /> Reschedule
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
      const data = await res.json() as { content?: string; hashtags?: string[]; error?: string };
      if (!res.ok) { setGenError(data.error ?? "Generation failed"); return; }
      setContent(data.content ?? "");
      setHashtags((data.hashtags ?? []).join(", "));
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
      const [todayRes, weekRes, articlesRes] = await Promise.all([
        fetch("/api/social/queue?date=today"),
        fetch("/api/social/queue?date=7days"),
        fetch("/api/editorial/review").then(async (r) => {
          // Pull recent articles from the digest for the composer picker
          if (!r.ok) return { articles: [] };
          const d = await r.json() as { digest?: { articles?: { draft: { headline?: string; featuredImage?: unknown } }[] } };
          return d;
        }),
      ]);

      if (todayRes.ok) {
        const d = await todayRes.json() as { posts: QueuePost[] };
        setTodayPosts(d.posts ?? []);
      }
      if (weekRes.ok) {
        const d = await weekRes.json() as { posts: QueuePost[] };
        setWeekPosts(d.posts ?? []);
      }

      // Fetch recent Sanity articles for the composer
      const artRes = await fetch(
        `https://cdn.sanity.io/data/v1/projects/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/datasets/${process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production"}/query?query=` +
          encodeURIComponent(`*[_type=="article"]|order(publishedAt desc)[0...20]{_id,title,slug,pillar->{name,slug}}`)
      );
      if (artRes.ok) {
        const d = await artRes.json() as { result?: ArticleOption[] };
        setArticles(d.result ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  async function handleGenerate() {
    setGenerating(true);
    setGenerateMsg("");
    try {
      const res = await fetch("/api/social/generate", { method: "POST" });
      const d = await res.json() as { postsGenerated?: number; message?: string };
      setGenerateMsg(d.message ?? `Generated ${d.postsGenerated ?? 0} posts`);
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
              <button onClick={handleApproveAll} disabled={approvingAll}
                className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2"
                style={{ background: "#15803d", color: "#fff", borderRadius: 2, opacity: approvingAll ? 0.6 : 1 }}>
                {approvingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Approve all
              </button>
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
