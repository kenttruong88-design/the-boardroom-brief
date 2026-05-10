"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, Loader2, RefreshCw, Send, AlertTriangle,
  Zap, Eye, BarChart2,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BufferProfile {
  platform: string;
  profileId: string | null;
  username:  string | null;
  connected: boolean;
}

interface BufferStatus {
  connected: boolean;
  profiles?: BufferProfile[];
  missingPlatforms?: string[];
  bufferPlan?: string;
  error?: string;
}

interface PostValidations {
  // linkedin
  hooksBeforeFold?: boolean; hookLength?: number; endsWithQuestion?: boolean;
  // twitter
  underCharLimit?: boolean; charCount?: number; remaining?: number;
  // instagram
  hasImage?: boolean; hasLinkInBio?: boolean;
}

interface EditorReview {
  score: number;
  passed: boolean;
  toneScore: number;
  accuracyScore: number;
  hookScore: number;
  satireScore: number;
  originalityScore: number;
  notes: string;
  revisionsRequired: string[];
}

interface PreviewPost {
  content: string;
  hashtags: string[];
  charCount: number;
  imageUrl: string | null;
  estimatedSlot: string;
  review: EditorReview | null;
  bufferPayload: { profileId: string; text: string; scheduledAt: string; mediaUrl: string | null };
  validations: PostValidations;
}

interface PreviewResult {
  article: { headline: string; pillar: string; slug: string; articleUrl: string };
  urlReachable: boolean;
  imageReachable: boolean;
  posts: { linkedin?: PreviewPost; twitter?: PreviewPost; instagram?: PreviewPost };
  totalMs: number;
  estimatedCost: string;
}

interface ArticleOption {
  id: string;
  title: string;
  pillar: string;
  publishedAt: string;
}

interface QueueRow {
  id: string;
  platform: string;
  article_headline: string;
  status: string;
  scheduled_for: string;
  buffer_post_id: string | null;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  linkedin:  { label: "LinkedIn",  color: "#0077b5", bg: "#e8f4fd" },
  twitter:   { label: "Twitter/X", color: "#111",    bg: "#f0f0f0" },
  instagram: { label: "Instagram", color: "#c13584", bg: "#fce4ec" },
};

const STATUS_COLORS: Record<string, string> = {
  pending:    "#b45309",
  sent:       "#15803d",
  failed:     "#b91c1c",
  cancelled:  "#6b7280",
  draft_test: "#7c3aed",
  sending:    "#1d4ed8",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
}

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

// ── PlatformStatusCard ────────────────────────────────────────────────────────

function PlatformStatusCard({ profile }: { profile: BufferProfile }) {
  const cfg = PLATFORM_CONFIG[profile.platform] ?? { label: profile.platform, color: "#666", bg: "#f5f5f5" };
  return (
    <div className="p-4 flex items-center gap-4"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <div>
        {profile.connected
          ? <CheckCircle className="w-6 h-6" style={{ color: "#15803d" }} />
          : <XCircle    className="w-6 h-6" style={{ color: "#b91c1c" }} />}
      </div>
      <div>
        <div className="text-sm font-sans font-semibold" style={{ color: cfg.color }}>{cfg.label}</div>
        {profile.connected && profile.username
          ? <div className="text-xs font-mono mt-0.5" style={{ color: "var(--ink-m)" }}>{profile.username}</div>
          : <div className="text-xs mt-0.5" style={{ color: "#b91c1c" }}>Not connected</div>}
      </div>
    </div>
  );
}

// ── PreviewCard ───────────────────────────────────────────────────────────────

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
        <span className="text-xs font-mono"
          style={{ color: overLimit ? "#b91c1c" : "#15803d", fontWeight: 600 }}>
          {post.charCount}/{charLimit}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 flex-1">
        <pre className="text-xs font-sans whitespace-pre-wrap mb-3 leading-relaxed select-text"
          style={{ color: "var(--ink)", background: "var(--cream)", padding: "10px", border: "1px solid var(--border)", borderRadius: 2 }}>
          {post.content}
        </pre>

        {/* Hashtags */}
        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {post.hashtags.map((t) => (
              <span key={t} className="text-xs font-mono px-1.5 py-0.5"
                style={{ background: "var(--cream)", border: "1px solid var(--border)", color: "var(--ink-m)" }}>
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Validations */}
        <div className="space-y-1 mb-3">
          {platform === "linkedin" && (
            <>
              {tick(v.hooksBeforeFold ?? false, `Hook before fold (${v.hookLength} chars)`)}
              {tick(v.endsWithQuestion ?? false, "Ends with question")}
            </>
          )}
          {platform === "twitter" && (
            <>
              {tick(v.underCharLimit ?? false, `${v.charCount}/${charLimit} chars (${v.remaining ?? 0} remaining)`)}
            </>
          )}
          {platform === "instagram" && (
            <>
              {tick(v.hasImage ?? false, "Image attached")}
              {tick(v.hasLinkInBio ?? false, "Link in bio text present")}
            </>
          )}
        </div>

        {/* Editor review */}
        {post.review && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-sans font-semibold" style={{ color: "var(--ink-m)" }}>
                Editor review
              </span>
              <span className="text-xs font-mono font-bold px-1.5 py-0.5"
                style={{
                  background: post.review.passed ? "#dcfce7" : "#fef2f2",
                  color: post.review.passed ? "#15803d" : "#b91c1c",
                  border: `1px solid ${post.review.passed ? "#86efac" : "#fecaca"}`,
                }}>
                {post.review.score}/10 {post.review.passed ? "PASS" : "FAIL"}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1 mb-2">
              {[
                ["Tone",     post.review.toneScore],
                ["Accuracy", post.review.accuracyScore],
                ["Hook",     post.review.hookScore],
                ["Satire",   post.review.satireScore],
                ["Original", post.review.originalityScore],
              ].map(([label, score]) => (
                <div key={label as string} className="text-center">
                  <div className="text-xs font-mono font-bold"
                    style={{ color: (score as number) >= 7 ? "#15803d" : "#b91c1c" }}>
                    {score}
                  </div>
                  <div className="text-xs font-sans" style={{ color: "var(--ink-m)", fontSize: "10px" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs font-sans leading-relaxed" style={{ color: "var(--ink-m)" }}>
              {post.review.notes}
            </p>
            {post.review.revisionsRequired.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {post.review.revisionsRequired.map((r, i) => (
                  <li key={i} className="text-xs font-sans" style={{ color: "#b45309" }}>
                    · {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Estimated slot */}
        <div className="text-xs font-mono mt-3" style={{ color: "var(--ink-m)" }}>
          Next slot: {formatTime(post.estimatedSlot)} UTC
        </div>
      </div>
    </div>
  );
}

// ── LiveModal ─────────────────────────────────────────────────────────────────

function LiveModal({
  onConfirm,
  onClose,
  loading,
}: {
  onConfirm: (platforms: string[], text: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({
    linkedin: true, twitter: true, instagram: false,
  });
  const [text, setText] = useState("");

  const required = "I understand this will post publicly";
  const valid = text === required && Object.values(selected).some(Boolean);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="max-w-md w-full mx-4 p-6"
        style={{ background: "#fff", border: "4px solid #b91c1c" }}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5" style={{ color: "#b91c1c" }} />
          <h3 className="text-lg font-serif font-bold" style={{ color: "#b91c1c" }}>Post live</h3>
        </div>

        <p className="text-sm font-sans mb-4" style={{ color: "var(--ink)" }}>
          This will post publicly to your connected social accounts. Posts go live in <strong>2 minutes</strong> — you have a window to cancel them in your Buffer dashboard.
        </p>

        {/* Platform checkboxes */}
        <div className="flex gap-4 mb-4">
          {["linkedin", "twitter", "instagram"].map((p) => {
            const cfg = PLATFORM_CONFIG[p];
            return (
              <label key={p} className="flex items-center gap-2 text-sm font-sans cursor-pointer">
                <input type="checkbox" checked={selected[p] ?? false}
                  onChange={(e) => setSelected((s) => ({ ...s, [p]: e.target.checked }))} />
                <span style={{ color: cfg.color }}>{cfg.label}</span>
              </label>
            );
          })}
        </div>

        {/* Typed confirmation */}
        <label className="block text-xs font-sans font-semibold mb-1" style={{ color: "var(--ink-m)" }}>
          Type: &ldquo;{required}&rdquo;
        </label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={required}
          className="w-full text-sm p-2 mb-4"
          style={{ border: "1px solid var(--border)", fontFamily: "var(--font-dm-sans)" }}
        />

        <div className="flex gap-3">
          <button onClick={() => { if (valid) onConfirm(Object.keys(selected).filter((k) => selected[k]), text); }}
            disabled={!valid || loading}
            className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2 flex-1 justify-center"
            style={{ background: !valid || loading ? "#fca5a5" : "#b91c1c", color: "#fff", borderRadius: 2, cursor: !valid || loading ? "not-allowed" : "pointer" }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Post live
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm font-sans"
            style={{ border: "1px solid var(--border)", borderRadius: 2 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SocialTestPage() {
  const router = useRouter();

  const [authed, setAuthed]               = useState<boolean | null>(null);
  const [bufferStatus, setBufferStatus]   = useState<BufferStatus | null>(null);
  const [bufferLoading, setBufferLoading] = useState(false);
  const [preview, setPreview]             = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [articleId, setArticleId]         = useState("");
  const [articles, setArticles]           = useState<ArticleOption[]>([]);
  const [queue, setQueue]                 = useState<QueueRow[]>([]);
  const [queueLoading, setQueueLoading]   = useState(false);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [liveLoading, setLiveLoading]     = useState(false);
  const [liveResult, setLiveResult]       = useState<boolean>(false);
  const [draftLoading, setDraftLoading]   = useState(false);
  const [draftResult, setDraftResult]     = useState<boolean>(false);
  const [actionError, setActionError]     = useState("");

  // Auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else setAuthed(true);
    });
  }, [router]);

  const fetchBufferStatus = useCallback(async () => {
    setBufferLoading(true);
    try {
      const res = await fetch("/api/test/social/buffer");
      setBufferStatus(await res.json() as BufferStatus);
    } finally {
      setBufferLoading(false);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await fetch("/api/social/queue?date=7days");
      if (res.ok) {
        const d = await res.json() as { posts: QueueRow[] };
        const sorted = (d.posts ?? []).sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setQueue(sorted.slice(0, 10));
      }
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      fetchBufferStatus();
      fetchQueue();
      fetch("/api/test/social/articles")
        .then((r) => r.json())
        .then((data) => setArticles(Array.isArray(data) ? data as ArticleOption[] : []));
    }
  }, [authed, fetchBufferStatus, fetchQueue]);

  async function handlePreview() {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const url = `/api/test/social/preview${articleId ? `?articleId=${articleId}` : ""}`;
      const res = await fetch(url);
      setPreview(await res.json() as PreviewResult);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSendDrafts() {
    setDraftLoading(true);
    setDraftResult(false);
    setActionError("");
    for (const platform of ["linkedin", "twitter", "instagram"] as const) {
      try {
        const res = await fetch("/api/test/social/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, confirmDraft: true, articleId: articleId || undefined }),
        });
        await res.json();
      } catch (err) {
        setActionError(String(err));
      }
    }
    setDraftResult(true);
    setDraftLoading(false);
    await fetchQueue();
  }

  async function handleLivePost(platforms: string[], confirmText: string) {
    setLiveLoading(true);
    setLiveResult(false);
    setActionError("");
    try {
      const res = await fetch("/api/test/social/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms,
          confirmLive: true,
          confirmText,
          articleId: articleId || undefined,
        }),
      });
      await res.json();
      setLiveResult(true);
      setShowLiveModal(false);
      await fetchQueue();
    } catch (err) {
      setActionError(String(err));
    } finally {
      setLiveLoading(false);
    }
  }

  if (authed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--navy)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      {showLiveModal && (
        <LiveModal
          onConfirm={handleLivePost}
          onClose={() => setShowLiveModal(false)}
          loading={liveLoading}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold" style={{ color: "var(--navy)" }}>
            Social media test lab
          </h1>
          <p className="text-sm font-sans mt-1" style={{ color: "var(--ink-m)" }}>
            Pre-flight checks before going live. All routes return 403 in production.
          </p>
        </div>

        {/* ── Buffer connection status ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>
              Buffer connection
            </h2>
            <button onClick={fetchBufferStatus} disabled={bufferLoading}
              className="flex items-center gap-1.5 text-xs font-sans px-3 py-1.5"
              style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)" }}>
              <RefreshCw className={`w-3.5 h-3.5 ${bufferLoading ? "animate-spin" : ""}`} />
              Check connection
            </button>
          </div>

          {bufferStatus === null ? (
            <div className="text-sm font-sans py-4" style={{ color: "var(--ink-m)" }}>
              {bufferLoading ? "Checking…" : "Not checked yet."}
            </div>
          ) : !bufferStatus.connected ? (
            <div className="p-4 text-sm font-sans" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
              <XCircle className="inline w-4 h-4 mr-2" />
              {bufferStatus.error}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                {(bufferStatus.profiles ?? []).map((p) => (
                  <PlatformStatusCard key={p.platform} profile={p} />
                ))}
              </div>
              <div className="text-xs font-mono" style={{ color: "var(--ink-m)" }}>
                Buffer plan: <strong>{bufferStatus.bufferPlan}</strong>
                {(bufferStatus.missingPlatforms ?? []).length > 0 && (
                  <span style={{ color: "#b45309" }}>
                    {" "}· Missing: {bufferStatus.missingPlatforms!.join(", ")}
                  </span>
                )}
              </div>
            </>
          )}
        </section>

        {/* ── Content preview ── */}
        <section className="mb-10">
          <h2 className="text-lg font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>
            <Eye className="inline w-5 h-5 mr-1" />
            Content preview
          </h2>

          <div className="flex gap-3 mb-4 flex-wrap">
            <select
              value={articleId}
              onChange={(e) => setArticleId(e.target.value)}
              className="text-sm font-sans p-2 flex-1 min-w-0"
              style={{ border: "1px solid var(--border)", background: "var(--cream)", color: "var(--ink)" }}
            >
              <option value="">Most recent article</option>
              {articles.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.pillar}] {a.title}
                </option>
              ))}
            </select>
            <button onClick={handlePreview} disabled={previewLoading}
              className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2"
              style={{ background: "var(--navy)", color: "#fff", borderRadius: 2 }}>
              {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Generate previews
            </button>
          </div>

          {preview && (
            <>
              <div className="text-xs font-mono mb-3 flex gap-4 flex-wrap" style={{ color: "var(--ink-m)" }}>
                <span>Article: <strong style={{ color: "var(--ink)" }}>{preview.article.headline}</strong></span>
                <span>{tick(preview.urlReachable, "URL reachable")}</span>
                <span>{tick(preview.imageReachable, "Image reachable")}</span>
                <span>Cost: {preview.estimatedCost}</span>
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

        {/* ── Test actions ── */}
        <section className="mb-10">
          <h2 className="text-lg font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>
            Test actions
          </h2>

          <div className="flex gap-3 flex-wrap">
            <button onClick={handleSendDrafts} disabled={draftLoading}
              className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2"
              style={{ background: "#7c3aed", color: "#fff", borderRadius: 2 }}>
              {draftLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send to Buffer as drafts
            </button>

            <button onClick={() => setShowLiveModal(true)}
              className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2"
              style={{ background: "#b91c1c", color: "#fff", borderRadius: 2 }}>
              <AlertTriangle className="w-4 h-4" />
              Post live now
            </button>
          </div>

          {actionError && (
            <div className="mt-3 text-xs font-mono p-3" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
              {actionError}
            </div>
          )}

          {draftResult && (
            <div className="mt-3 text-xs font-mono p-3" style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", color: "#7c3aed", borderRadius: 2 }}>
              Drafts sent to Buffer.{" "}
              <a href="https://buffer.com/app/publishing" target="_blank" rel="noreferrer"
                className="underline font-bold">
                Open Buffer dashboard →
              </a>
            </div>
          )}

          {liveResult && (
            <div className="mt-3 text-xs font-mono p-3"
              style={{ background: "#fef2f2", border: "2px solid #b91c1c", color: "#b91c1c", borderRadius: 2 }}>
              Posts scheduled. Going live in ~2 min.{" "}
              <a href="https://buffer.com/app/publishing" target="_blank" rel="noreferrer"
                className="underline font-bold">
                Cancel in Buffer →
              </a>
            </div>
          )}
        </section>

        {/* ── Queue inspector ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>
              <BarChart2 className="inline w-5 h-5 mr-1" />
              Queue inspector — last 10 rows
            </h2>
            <button onClick={fetchQueue} disabled={queueLoading}
              className="flex items-center gap-1.5 text-xs font-sans px-3 py-1.5"
              style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)" }}>
              <RefreshCw className={`w-3.5 h-3.5 ${queueLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", overflowX: "auto" }}>
            <table className="w-full text-xs font-sans" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  {["Platform", "Headline", "Status", "Scheduled for", "Buffer ID"].map((h) => (
                    <th key={h} className="text-left py-2 px-3 font-semibold uppercase tracking-wider"
                      style={{ color: "var(--ink-m)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center" style={{ color: "var(--ink-m)" }}>
                      {queueLoading ? "Loading…" : "No rows found"}
                    </td>
                  </tr>
                ) : (
                  queue.map((row) => {
                    const cfg = PLATFORM_CONFIG[row.platform];
                    const statusColor = STATUS_COLORS[row.status] ?? "#666";
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="py-2 px-3">
                          <span className="text-xs font-sans font-semibold px-1.5 py-0.5"
                            style={{ color: cfg?.color ?? "#666", background: cfg?.bg ?? "#f5f5f5", borderRadius: 2 }}>
                            {cfg?.label ?? row.platform}
                          </span>
                        </td>
                        <td className="py-2 px-3 max-w-xs truncate" style={{ color: "var(--ink)" }}
                          title={row.article_headline}>
                          {row.article_headline}
                        </td>
                        <td className="py-2 px-3 font-mono" style={{ color: statusColor }}>{row.status}</td>
                        <td className="py-2 px-3 font-mono whitespace-nowrap" style={{ color: "var(--ink-m)" }}>
                          {formatTime(row.scheduled_for)} UTC
                        </td>
                        <td className="py-2 px-3 font-mono" style={{ color: "var(--ink-m)" }}>
                          {row.buffer_post_id
                            ? <span title={row.buffer_post_id}>{row.buffer_post_id.slice(0, 12)}…</span>
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
