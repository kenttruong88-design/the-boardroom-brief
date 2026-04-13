"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { createClient } from "@/app/lib/supabase";
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
}: {
  entry: ArticleEntry;
  index: number;
  onApprove: (i: number) => void;
  onReject: (i: number) => void;
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
          className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2 transition-opacity hover:opacity-80"
          style={{ background: "#15803d", color: "#fff", borderRadius: "2px" }}
        >
          <CheckCircle className="w-4 h-4" /> Approve + Publish
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
  const [showRejected, setShowRejected] = useState(false);
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
        if (data.digest_json) setDigest(data.digest_json as DailyDigest);
        else setError("No digest found for today.");
      })
      .catch(() => setError("Failed to load digest."))
      .finally(() => setLoading(false));
  }, [authed]);

  async function handleApprove(index: number) {
    const entry = digest!.articles[index];
    // Publish to Sanity
    const res = await fetch("/api/editorial/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry.draft),
    });
    if (res.ok) {
      await fetch("/api/editorial/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", articleIndex: index }),
      });
      setActioned((prev) => ({ ...prev, [index]: "approved" }));
    }
  }

  async function handleReject(index: number) {
    await fetch("/api/editorial/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", articleIndex: index }),
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
    .filter(({ entry, i }) => entry.review.passed && !actioned[i]);

  const rejected = digest.articles
    .map((entry, i) => ({ entry, i }))
    .filter(({ entry, i }) => !entry.review.passed || actioned[i] === "rejected");

  const approved = Object.values(actioned).filter((v) => v === "approved").length;

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
            {approved > 0 && <span><strong style={{ color: "#1d4ed8" }}>{approved}</strong> published today</span>}
          </div>
        </div>

        {/* Passed articles */}
        {passed.length > 0 ? (
          <div className="mb-10">
            <h2 className="eyebrow mb-5">Ready for review ({passed.length})</h2>
            {passed.map(({ entry, i }) => (
              <ArticleCard
                key={i}
                entry={entry}
                index={i}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center mb-10" style={{ border: "1px solid var(--border)" }}>
            <p className="eyebrow-muted">No articles pending review</p>
          </div>
        )}

        {/* Rejected articles — collapsed */}
        {rejected.length > 0 && (
          <div>
            <button
              onClick={() => setShowRejected((v) => !v)}
              className="flex items-center gap-2 text-sm font-sans mb-4 transition-opacity hover:opacity-70"
              style={{ color: "var(--ink-m)" }}
            >
              {showRejected ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Not passing / rejected ({rejected.length})
            </button>
            {showRejected && (
              <div className="space-y-3">
                {rejected.map(({ entry, i }) => (
                  <div
                    key={i}
                    className="p-4"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: 0.7 }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="eyebrow-muted mr-2">{pillarLabel(entry.draft.pillar)}</span>
                        <span className="text-sm font-serif font-bold" style={{ color: "var(--navy)" }}>
                          {entry.draft.headline}
                        </span>
                      </div>
                      <ScoreBadge score={entry.review.score} />
                    </div>
                    <p className="text-xs font-sans mt-1" style={{ color: "var(--ink-m)" }}>{entry.review.notes}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
