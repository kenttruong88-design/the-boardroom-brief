"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { createClient } from "@/app/lib/supabase";
import RejectedArticlesSection from "@/app/components/editorial/RejectedArticlesSection";
import type { DailyDigest, ArticleDraft, EditorReview } from "@/app/lib/agents/types";

type ArticleEntry = { draft: ArticleDraft; review: EditorReview };

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 9 ? "#15803d" : score >= 7 ? "#1d4ed8" : "#c8391a";
  return (
    <span
      className="text-xs font-mono font-bold px-2 py-0.5"
      style={{ color, border: `1px solid ${color}`, borderRadius: "2px" }}
    >
      {score}/10
    </span>
  );
}

function pillarLabel(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ArticleCard({
  entry,
  index,
  onApprove,
  onReject,
  approving,
}: {
  entry: ArticleEntry;
  index: number;
  onApprove: (i: number) => void;
  onReject: (i: number) => void;
  approving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { draft, review } = entry;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <div
      className="p-6 mb-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow">{pillarLabel(draft.pillar)}</span>
            <span className="eyebrow-muted">·</span>
            <span className="eyebrow-muted">{draft.agentName}</span>
          </div>
          <h2 className="text-xl font-serif font-bold leading-snug" style={{ color: "var(--navy)" }}>
            {draft.headline}
          </h2>
          <p className="text-sm font-serif italic mt-1" style={{ color: "var(--ink-m)" }}>
            {draft.satiricalHeadline}
          </p>
        </div>
        <ScoreBadge score={review.score} />
      </div>

      {/* Score breakdown */}
      <div className="flex flex-wrap gap-3 mb-4">
        {[
          { label: "Tone", val: review.toneScore },
          { label: "Accuracy", val: review.accuracyScore },
          { label: "Headline", val: review.headlineScore },
          { label: "Satire", val: review.satireScore },
          { label: "Originality", val: review.originalityScore },
        ].map(({ label, val }) => (
          <div key={label} className="text-center">
            <div className="text-xs font-mono font-bold" style={{ color: "var(--navy)" }}>{val}</div>
            <div className="text-2xs eyebrow-muted">{label}</div>
          </div>
        ))}
      </div>

      {/* Editor notes */}
      <div
        className="text-sm font-sans italic p-3 mb-4"
        style={{ background: "var(--cream)", border: "1px solid var(--border)", color: "var(--ink-m)" }}
      >
        {review.notes}
      </div>

      {/* Body preview / toggle */}
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
          {draft.body.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {draft.tags.map((tag) => (
          <span
            key={tag}
            className="text-2xs font-mono px-2 py-0.5"
            style={{ background: "var(--cream)", border: "1px solid var(--border)", color: "var(--ink-m)" }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onApprove(index)}
          disabled={approving}
          className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2 transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "#15803d", color: "#fff", borderRadius: "2px" }}
        >
          <CheckCircle className="w-4 h-4" />
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
    </div>
  );
}

export default function EditorialDashboard() {
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [actioned, setActioned] = useState<Record<number, "approved" | "rejected">>({});
  const [approvingIndex, setApprovingIndex] = useState<number | null>(null);
  const [publishedUrls, setPublishedUrls] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  // Auth check
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(!!data.user);
    });
  }, []);

  // Fetch digest
  useEffect(() => {
    if (!authed) return;
    fetch("/api/editorial/review")
      .then((r) => r.json())
      .then((data) => {
        if (data.digest) setDigest(data.digest as DailyDigest);
        else setError("No digest found for today.");
      })
      .catch(() => setError("Failed to load digest."))
      .finally(() => setLoading(false));
  }, [authed]);

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
        if (data.publishedUrl) {
          setPublishedUrls((prev) => ({ ...prev, [index]: data.publishedUrl! }));
        }
      } else {
        alert(data.error ?? "Approval failed. Please try again.");
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

  if (authed === false) {
    return (
      <div className="container-editorial py-20 text-center">
        <p className="eyebrow mb-4">Access restricted</p>
        <h1 className="text-3xl font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>Sign in to access the editorial dashboard</h1>
        <a href="/login" className="btn-red">Sign in</a>
      </div>
    );
  }

  if (loading || authed === null) {
    return (
      <div className="container-editorial py-20 text-center">
        <p className="eyebrow-muted">Loading digest…</p>
      </div>
    );
  }

  if (error || !digest) {
    return (
      <div className="container-editorial py-20 text-center">
        <p className="eyebrow-muted mb-4">{error || "No digest available."}</p>
        <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>
          Run the daily agent pipeline to generate today's articles.
        </p>
      </div>
    );
  }

  const passed = digest.articles
    .map((entry, i) => ({ entry, i }))
    .filter(({ i }) => digest.articles[i].review.passed && !actioned[i]);

  const rejected = digest.articles
    .map((entry, i) => ({ entry, i, articleIndex: i }))
    .filter(({ i }) => !digest.articles[i].review.passed || actioned[i] === "rejected")
    .map(({ entry, i }) => ({ ...entry, articleIndex: i }));

  const approvedCount = Object.values(actioned).filter((v) => v === "approved").length;

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="container-editorial py-10">

        {/* Page header */}
        <div className="mb-8 pb-6" style={{ borderBottom: "2px solid var(--navy)" }}>
          <p className="eyebrow mb-1">Editorial Dashboard</p>
          <h1 className="text-3xl font-serif font-bold" style={{ color: "var(--navy)" }}>
            Daily Digest — {digest.date}
          </h1>
          <div className="flex gap-6 mt-3 text-sm font-sans" style={{ color: "var(--ink-m)" }}>
            <span><strong style={{ color: "var(--navy)" }}>{digest.totalArticles}</strong> written</span>
            <span><strong style={{ color: "#15803d" }}>{digest.passedArticles}</strong> passed</span>
            <span><strong style={{ color: "var(--red)" }}>{digest.rejectedArticles}</strong> rejected</span>
            {approvedCount > 0 && <span><strong style={{ color: "#1d4ed8" }}>{approvedCount}</strong> published today</span>}
          </div>
        </div>

        {/* Passed articles */}
        {passed.length > 0 ? (
          <div className="mb-10">
            <h2 className="eyebrow mb-5">Ready for review ({passed.length})</h2>
            {passed.map(({ entry, i }) => (
              <div key={i}>
                <ArticleCard
                  entry={entry}
                  index={i}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  approving={approvingIndex === i}
                />
                {actioned[i] === "approved" && publishedUrls[i] && (
                  <div
                    className="flex items-center gap-2 px-4 py-2 mb-4 -mt-3 text-sm font-sans"
                    style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d" }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Published —{" "}
                    <a
                      href={publishedUrls[i]}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#15803d", textDecoration: "underline" }}
                    >
                      View live article →
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center mb-10" style={{ border: "1px solid var(--border)" }}>
            <p className="eyebrow-muted">No articles pending review</p>
          </div>
        )}

        {/* Rejected articles */}
        <RejectedArticlesSection
          rejectedArticles={rejected}
          onDismiss={(articleIndex) =>
            setActioned((prev) => ({ ...prev, [articleIndex]: "rejected" }))
          }
        />

      </div>
    </div>
  );
}
