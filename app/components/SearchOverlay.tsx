"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, FileText } from "lucide-react";
import type { AlgoliaArticle } from "@/app/lib/algolia";

interface Hit extends AlgoliaArticle {
  _highlightResult?: {
    title?: { value: string };
    satiricalHeadline?: { value: string };
    excerpt?: { value: string };
  };
}

interface Props {
  onClose: () => void;
}

const PILLAR_COLORS: Record<string, string> = {
  "markets-floor":  "#1d4ed8",
  "macro-mondays":  "#15803d",
  "c-suite-circus": "#b45309",
  "global-office":  "#7c3aed",
  "water-cooler":   "#0891b2",
  "off-the-record": "#be185d",
};

function PillarBadge({ slug, name }: { slug: string; name: string }) {
  const color = PILLAR_COLORS[slug] ?? "#6b7280";
  return (
    <span
      className="inline-block font-body text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 shrink-0"
      style={{ color, border: `1px solid ${color}`, opacity: 0.85 }}
    >
      {name}
    </span>
  );
}

// Render Algolia highlight HTML safely — only <mark> tags allowed
function Highlight({ html, fallback }: { html?: string; fallback: string }) {
  if (!html) return <>{fallback}</>;
  return (
    <span
      dangerouslySetInnerHTML={{ __html: html.replace(/<(?!\/?mark)[^>]+>/g, "") }}
    />
  );
}

export default function SearchOverlay({ onClose }: Props) {
  const router = useRouter();
  const [query, setQuery]           = useState("");
  const [hits, setHits]             = useState<Hit[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Cmd/Ctrl+K shortcut already handled by Header; Escape handled below

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setHits([]); setError(""); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { hits?: Hit[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Search unavailable.");
        setHits([]);
      } else {
        setHits(data.hits ?? []);
      }
    } catch {
      setError("Search unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSelectedIdx(-1);
    if (query.trim().length < 2) { setHits([]); setError(""); return; }
    debounceRef.current = setTimeout(() => search(query.trim()), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  function navigateTo(hit: Hit) {
    router.push(`/${hit.pillarSlug}/${hit.slug}`);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (hits.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && selectedIdx >= 0) {
      e.preventDefault();
      navigateTo(hits[selectedIdx]);
    }
  }

  const showResults = query.length >= 2;
  const noResults   = showResults && !loading && hits.length === 0 && !error;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(15,25,35,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* ── Input bar ── */}
      <div className="bg-cream-100 dark:bg-navy-500 border-b-2 border-navy-500 dark:border-cream-200">
        <div className="site-container py-4 flex items-center gap-3">
          {loading
            ? <Loader2 className="w-5 h-5 shrink-0 animate-spin text-red-500" />
            : <Search className="w-5 h-5 shrink-0 text-ink-muted dark:text-cream-300" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search articles…"
            className="flex-1 font-body text-base bg-transparent text-ink dark:text-cream-100 placeholder:text-ink-faint dark:placeholder:text-cream-500 outline-none"
          />
          <button
            onClick={onClose}
            className="text-ink-muted dark:text-cream-300 hover:text-red-500 transition-colors duration-[120ms]"
            aria-label="Close search"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Results panel ── */}
      {showResults && (
        <div className="bg-cream-100 dark:bg-navy-500 overflow-y-auto"
          style={{ maxHeight: "min(60vh, 520px)" }}>
          <div className="site-container py-2">

            {/* Error */}
            {error && (
              <p className="font-body text-sm text-red-500 py-4">{error}</p>
            )}

            {/* No results */}
            {noResults && (
              <div className="flex items-center gap-3 py-6 text-ink-muted dark:text-cream-300">
                <FileText className="w-5 h-5 shrink-0" />
                <p className="font-body text-sm">
                  No articles found for <strong className="text-ink dark:text-cream-100">&ldquo;{query}&rdquo;</strong>
                </p>
              </div>
            )}

            {/* Hit list */}
            {hits.length > 0 && (
              <ul className="divide-y divide-rule dark:divide-rule-dark">
                {hits.map((hit, i) => {
                  const active = i === selectedIdx;
                  return (
                    <li key={hit.objectID}>
                      <button
                        className="w-full text-left flex items-start gap-4 py-3.5 transition-colors duration-[80ms]"
                        style={{ background: active ? "rgba(15,25,35,0.06)" : "transparent" }}
                        onMouseEnter={() => setSelectedIdx(i)}
                        onMouseLeave={() => setSelectedIdx(-1)}
                        onClick={() => navigateTo(hit)}
                      >
                        {/* Thumbnail */}
                        {hit.heroImageUrl ? (
                          <img
                            src={hit.heroImageUrl}
                            alt=""
                            className="w-14 h-10 object-cover shrink-0 hidden sm:block"
                            style={{ opacity: 0.9 }}
                          />
                        ) : (
                          <div
                            className="w-14 h-10 shrink-0 hidden sm:block"
                            style={{ background: "var(--border)" }}
                          />
                        )}

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <PillarBadge slug={hit.pillarSlug} name={hit.pillarName} />
                          </div>
                          <p className="font-headline font-bold text-sm text-navy-500 dark:text-cream-100 leading-snug mb-0.5 line-clamp-1">
                            <Highlight
                              html={hit._highlightResult?.title?.value}
                              fallback={hit.title}
                            />
                          </p>
                          {hit.satiricalHeadline && (
                            <p className="font-prose italic text-xs text-ink-muted dark:text-cream-300 line-clamp-1 mb-0.5">
                              <Highlight
                                html={hit._highlightResult?.satiricalHeadline?.value}
                                fallback={hit.satiricalHeadline}
                              />
                            </p>
                          )}
                          {hit.excerpt && (
                            <p className="font-body text-xs text-ink-faint dark:text-cream-500 line-clamp-1">
                              <Highlight
                                html={hit._highlightResult?.excerpt?.value}
                                fallback={hit.excerpt}
                              />
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Keyboard hint */}
            {hits.length > 0 && (
              <p className="font-body text-[10px] text-ink-faint dark:text-cream-500 py-2 text-right select-none">
                ↑↓ navigate · Enter select · Esc close
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
