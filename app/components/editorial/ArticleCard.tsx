"use client";

import { useState } from "react";
import { PortableText } from "@portabletext/react";
import { ChevronDown, ChevronRight, CheckCircle, XCircle, ExternalLink, Loader2 } from "lucide-react";
import type { ArticleDraft, EditorReview } from "@/app/lib/agents/types";

// ── Agent avatars ─────────────────────────────────────────────────────────────

const AGENT_AVATARS: Record<string, { initials: string; bg: string; fg: string }> = {
  "Rex Volkov":     { initials: "RV", bg: "#1d4ed8", fg: "#fff" },
  "Ingrid Holt":    { initials: "IH", bg: "#6b7280", fg: "#fff" },
  "Miles Bancroft": { initials: "MB", bg: "#d97706", fg: "#fff" },
  "Priya Mehta":    { initials: "PM", fg: "#fff",    bg: "#0f766e" },
  "Danny Fisk":     { initials: "DF", bg: "#e85d4a", fg: "#fff" },
};

// ── Pillar data ───────────────────────────────────────────────────────────────

const PILLAR_LABELS: Record<string, string> = {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extracts a display name from a URL: "https://www.reuters.com/..." → "Reuters" */
function extractSourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const domain = host.split(".")[0];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return url.slice(0, 24);
  }
}

function scoreLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 8.5) return { label: `${score.toFixed(1)}`,  color: "#15803d", bg: "rgba(21,128,61,0.1)" };
  if (score >= 7.0) return { label: `${score.toFixed(1)}`,  color: "#1d4ed8", bg: "rgba(29,78,216,0.1)" };
  return               { label: `${score.toFixed(1)}`,  color: "#d97706", bg: "rgba(217,119,6,0.1)"  };
}

// ── Full-article body renderer ────────────────────────────────────────────────

function ArticleBody({ body }: { body: string | unknown[] }) {
  // Portable Text shape: array of block objects
  if (Array.isArray(body)) {
    return (
      <div className="prose prose-sm max-w-none font-serif" style={{ color: "var(--ink)" }}>
        <PortableText value={body as Parameters<typeof PortableText>[0]["value"]} />
      </div>
    );
  }

  // Plain string — split on double newline
  return (
    <div className="space-y-4 font-serif text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
      {String(body)
        .split(/\n\n+/)
        .filter(Boolean)
        .map((para, i) => (
          <p key={i}>{para.trim()}</p>
        ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  draft: ArticleDraft;
  review: EditorReview;
  index: number;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArticleCard({ draft, review, index, onApprove, onReject }: Props) {
  type CardState = "idle" | "approving" | "approved" | "rejected";

  const [cardState, setCardState]       = useState<CardState>("idle");
  const [sanityDocId, setSanityDocId]   = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [expanded, setExpanded]         = useState(false);
  const [errorMsg, setErrorMsg]         = useState("");
  const [imageHovered, setImageHovered] = useState(false);

  const articleId   = String(index);
  const avatar      = AGENT_AVATARS[draft.agentName];
  const pillarColor = PILLAR_COLORS[draft.pillar] ?? "#c8391a";
  const { label: scoreStr, color: scoreColor, bg: scoreBg } = scoreLabel(review.score);
  const showEditorNote = !!review.notes && review.score < 8.5;

  // sourceUrls is not on the canonical type yet — handled as optional extension
  const sourceUrls: string[] = (draft as ArticleDraft & { sourceUrls?: string[] }).sourceUrls ?? [];

  const studioBase = process.env.NEXT_PUBLIC_SANITY_STUDIO_URL
    ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/studio`;
  const sanityStudioUrl = sanityDocId
    ? `${studioBase}/structure/article;${sanityDocId}`
    : `${studioBase}`;

  // ── Border style by state ─────────────────────────────────────────────────

  const borderLeft =
    cardState === "approved" ? "4px solid #15803d" :
    cardState === "rejected" ? "4px solid #c8391a" :
    `4px solid ${pillarColor}`;

  const opacity = cardState === "rejected" ? 0.5 : 1;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleApprove() {
    setCardState("approving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/editorial/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      const data = await res.json() as {
        success?: boolean;
        sanityDocId?: string;
        publishedUrl?: string;
        error?: string;
      };

      if (res.ok && data.success) {
        setSanityDocId(data.sanityDocId ?? null);
        setPublishedUrl(data.publishedUrl ?? null);
        setCardState("approved");
        onApprove(articleId);
      } else {
        setErrorMsg(data.error ?? "Approval failed. Please try again.");
        setCardState("idle");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setCardState("idle");
    }
  }

  async function handleReject() {
    try {
      await fetch("/api/editorial/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
    } catch {
      // non-fatal — still update UI
    }
    setCardState("rejected");
    onReject(articleId);
  }

  function handleUndo() {
    // Resets visual state — the Sanity document remains published
    setCardState("idle");
    setSanityDocId(null);
    setPublishedUrl(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <article
      style={{
        border: "1px solid var(--border)",
        borderLeft,
        background: "var(--surface)",
        opacity,
        transition: "opacity 0.3s, border-left-color 0.3s",
      }}
    >
      {/* ── 1. CARD HEADER ─────────────────────────────────────────────── */}
      <div className="p-5 pb-4">
        <div className="flex items-start gap-3 mb-3">
          {/* Agent avatar */}
          <div
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-xs font-mono font-bold"
            style={{
              background: avatar?.bg ?? pillarColor,
              color: avatar?.fg ?? "#fff",
              letterSpacing: "0.5px",
            }}
            title={draft.agentName}
          >
            {avatar?.initials ?? draft.agentName.slice(0, 2).toUpperCase()}
          </div>

          {/* Agent name + pillar */}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-sans font-semibold" style={{ color: "var(--navy)" }}>
                {draft.agentName}
              </span>
              <span
                className="text-2xs font-mono font-semibold px-1.5 py-0.5"
                style={{
                  color: pillarColor,
                  border: `1px solid ${pillarColor}`,
                  borderRadius: "2px",
                  letterSpacing: "0.5px",
                }}
              >
                {PILLAR_LABELS[draft.pillar] ?? draft.pillar}
              </span>
            </div>
          </div>
        </div>

        {/* Headline */}
        <h2
          className="font-sans font-medium leading-snug mb-1"
          style={{ fontSize: "14px", color: "var(--navy)" }}
        >
          {draft.headline}
        </h2>

        {/* Satirical subheadline */}
        <p
          className="font-serif italic leading-snug"
          style={{ fontSize: "12px", color: "var(--ink-m)" }}
        >
          {draft.satiricalHeadline}
        </p>
      </div>

      {/* ── 2. SCORE ROW ───────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 flex-wrap px-5 py-2.5"
        style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--cream)" }}
      >
        {/* Score pill */}
        <span
          className="text-xs font-mono font-bold px-2 py-0.5"
          style={{ color: scoreColor, background: scoreBg, borderRadius: "999px" }}
        >
          {scoreStr}/10
        </span>

        {/* Pillar badge (duplicate intentional — score row reads independently) */}
        <span
          className="text-2xs font-mono uppercase tracking-wide"
          style={{ color: pillarColor }}
        >
          {PILLAR_LABELS[draft.pillar] ?? draft.pillar}
        </span>

        {/* Divider */}
        {draft.countries?.length > 0 && (
          <span style={{ color: "var(--border)" }}>·</span>
        )}

        {/* Country tags */}
        {draft.countries?.slice(0, 3).map((c) => (
          <span
            key={c}
            className="text-2xs font-mono px-1.5 py-0.5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--ink-m)",
              borderRadius: "2px",
            }}
          >
            {c.toUpperCase()}
          </span>
        ))}
        {draft.countries?.length > 3 && (
          <span className="text-2xs font-sans" style={{ color: "var(--ink-m)" }}>
            +{draft.countries.length - 3}
          </span>
        )}

        {/* Individual dimension scores — right-aligned */}
        <div className="ml-auto flex items-center gap-3">
          {[
            { label: "T", val: review.toneScore,        title: "Tone" },
            { label: "A", val: review.accuracyScore,    title: "Accuracy" },
            { label: "H", val: review.headlineScore,    title: "Headline" },
            { label: "S", val: review.satireScore,      title: "Satire" },
            { label: "O", val: review.originalityScore, title: "Originality" },
          ].map(({ label, val, title }) => {
            const c = val >= 9 ? "#15803d" : val >= 7 ? "#1d4ed8" : val >= 5 ? "#d97706" : "#c8391a";
            return (
              <span key={label} className="text-2xs font-mono" title={title} style={{ color: "var(--ink-m)" }}>
                {label}
                <span className="font-bold ml-0.5" style={{ color: c }}>{val}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ── 3. IMAGE PREVIEW ───────────────────────────────────────────── */}
      <div
        style={{ position: "relative", paddingTop: "56.25%", background: "var(--surface)", overflow: "hidden", borderTop: "1px solid var(--border)" }}
        onMouseEnter={() => setImageHovered(true)}
        onMouseLeave={() => setImageHovered(false)}
      >
        {draft.featuredImage ? (
          <>
            <img
              src={draft.featuredImage.thumbnailUrl}
              alt={draft.featuredImage.altText}
              title={draft.featuredImage.generatedPrompt}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Source badge */}
            <span
              style={{
                position: "absolute", bottom: 8, left: 8,
                background: "rgba(0,0,0,0.55)", color: "#fff",
                fontSize: "9px", fontFamily: "Arial, sans-serif", fontWeight: 700,
                letterSpacing: "0.8px", textTransform: "uppercase",
                padding: "2px 6px", borderRadius: "2px",
              }}
            >
              {draft.featuredImage.generatedWith === "unsplash" ? "Unsplash" : "AI generated"}
            </span>
            {/* Hover overlay — Replace image */}
            {imageHovered && (
              <a
                href={sanityStudioUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(15,25,35,0.55)",
                  color: "#fff", fontSize: "12px",
                  fontFamily: "Arial, sans-serif", fontWeight: 600,
                  textDecoration: "none", gap: "6px",
                  transition: "background 0.15s",
                }}
              >
                <ExternalLink style={{ width: 14, height: 14 }} />
                Replace image in Sanity
              </a>
            )}
          </>
        ) : (
          <div
            style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 10,
            }}
          >
            <p style={{ color: "var(--ink-m)", fontSize: "12px", fontFamily: "Arial, sans-serif", margin: 0 }}>
              No image — will publish without hero image
            </p>
            <a
              href={sanityStudioUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: "11px", fontFamily: "Arial, sans-serif",
                color: "var(--navy)", border: "1px solid var(--border)",
                padding: "4px 10px", textDecoration: "none", borderRadius: "2px",
              }}
            >
              Add image in Sanity
            </a>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* ── 4. EDITOR NOTE ───────────────────────────────────────────── */}
        {showEditorNote && (
          <div
            className="px-3 py-2.5"
            style={{
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              borderLeft: "3px solid #d97706",
            }}
          >
            <p className="text-2xs font-sans font-bold uppercase tracking-widest mb-1" style={{ color: "#92400e" }}>
              Editor note
            </p>
            <p className="text-xs font-serif italic leading-relaxed" style={{ color: "#78350f" }}>
              {review.notes}
            </p>
          </div>
        )}

        {/* ── 5. ARTICLE PREVIEW ───────────────────────────────────────── */}
        <p
          className="font-serif leading-relaxed"
          style={{ fontSize: "13px", color: "var(--ink-m)" }}
        >
          {draft.body.slice(0, 200).trimEnd()}
          {draft.body.length > 200 ? "…" : ""}
        </p>

        {/* ── 5. SOURCES ROW ───────────────────────────────────────────── */}
        {sourceUrls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sourceUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-2xs font-mono px-2 py-1 transition-opacity hover:opacity-70"
                style={{
                  background: "var(--cream)",
                  border: "1px solid var(--border)",
                  color: "var(--ink-m)",
                  borderRadius: "2px",
                  textDecoration: "none",
                }}
              >
                <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                {extractSourceName(url)}
              </a>
            ))}
          </div>
        )}

        {/* ── 6. ACTION ROW ────────────────────────────────────────────── */}
        {errorMsg && (
          <p className="text-xs font-sans" style={{ color: "var(--red)" }}>{errorMsg}</p>
        )}

        {cardState === "approved" ? (
          /* Published confirmation */
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className="flex items-center gap-2 px-3 py-2 text-sm font-sans"
              style={{
                background: "rgba(21,128,61,0.08)",
                border: "1px solid rgba(21,128,61,0.3)",
                color: "#15803d",
                borderRadius: "2px",
              }}
            >
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">Published to Sanity</span>
              {publishedUrl && (
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline ml-1 transition-opacity hover:opacity-70"
                  style={{ color: "#15803d" }}
                >
                  View live →
                </a>
              )}
            </div>

            <a
              href={sanityStudioUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-sans transition-opacity hover:opacity-70"
              style={{
                border: "1px solid var(--border)",
                color: "var(--navy)",
                borderRadius: "2px",
                textDecoration: "none",
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Edit in Sanity
            </a>

            <button
              onClick={handleUndo}
              className="ml-auto text-xs font-sans transition-opacity hover:opacity-70"
              style={{ color: "var(--ink-m)", textDecoration: "underline" }}
              title="Reset card (does not unpublish from Sanity)"
            >
              Undo
            </button>
          </div>
        ) : cardState === "rejected" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>Rejected</span>
          </div>
        ) : (
          /* Idle / approving */
          <div className="flex items-center gap-2 flex-wrap">
            {/* Approve */}
            <button
              onClick={handleApprove}
              disabled={cardState === "approving"}
              className="flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-2 transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                border: "1px solid #15803d",
                color: "#15803d",
                borderRadius: "2px",
                background: "transparent",
              }}
            >
              {cardState === "approving"
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <CheckCircle className="w-3.5 h-3.5" />}
              {cardState === "approving" ? "Publishing…" : "Approve + publish"}
            </button>

            {/* Edit in Sanity */}
            <a
              href={sanityStudioUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-sans px-3 py-2 transition-opacity hover:opacity-70"
              style={{
                border: "1px solid var(--border)",
                color: "var(--ink-m)",
                borderRadius: "2px",
                textDecoration: "none",
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Edit in Sanity
            </a>

            {/* Reject */}
            <button
              onClick={handleReject}
              disabled={cardState === "approving"}
              className="flex items-center gap-1.5 text-xs font-sans px-3 py-2 transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{
                border: "1px solid var(--border)",
                color: "var(--red)",
                borderRadius: "2px",
              }}
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </button>

            {/* Read full article — right-aligned */}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="ml-auto flex items-center gap-1 text-xs font-sans transition-opacity hover:opacity-70"
              style={{ color: "var(--ink-m)" }}
            >
              {expanded
                ? <ChevronDown className="w-3.5 h-3.5" />
                : <ChevronRight className="w-3.5 h-3.5" />}
              {expanded ? "Collapse" : "Read full article"}
            </button>
          </div>
        )}

        {/* ── 7. FULL ARTICLE EXPAND ───────────────────────────────────── */}
        {expanded && (
          <div
            className="mt-2 p-4"
            style={{
              background: "var(--cream)",
              border: "1px solid var(--border)",
              borderTop: `2px solid ${pillarColor}`,
            }}
          >
            {/* Pull quote if available */}
            {(draft as ArticleDraft & { pullQuote?: string }).pullQuote && (
              <blockquote
                className="font-serif italic text-base leading-relaxed mb-5 pl-4"
                style={{
                  color: "var(--ink-m)",
                  borderLeft: `3px solid ${pillarColor}`,
                }}
              >
                "{(draft as ArticleDraft & { pullQuote?: string }).pullQuote}"
              </blockquote>
            )}

            <ArticleBody body={draft.body} />

            {/* Tags */}
            {draft.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                {draft.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-2xs font-mono px-2 py-0.5"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--ink-m)",
                      borderRadius: "2px",
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Market symbols */}
            {draft.marketSymbols?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {draft.marketSymbols.map((sym) => (
                  <span
                    key={sym}
                    className="text-2xs font-mono font-bold"
                    style={{ color: pillarColor }}
                  >
                    ${sym}
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={() => setExpanded(false)}
              className="mt-5 text-xs font-sans transition-opacity hover:opacity-60"
              style={{ color: "var(--ink-m)" }}
            >
              ↑ Collapse
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
