"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { Search, X, Loader2, FileText, Clock, ArrowRight } from "lucide-react";
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

const PILLARS = [
  { slug: "markets-floor",  label: "Markets",    color: "#1d4ed8" },
  { slug: "macro-mondays",  label: "Macro",      color: "#15803d" },
  { slug: "c-suite-circus", label: "C-Suite",    color: "#b45309" },
  { slug: "global-office",  label: "Global",     color: "#7c3aed" },
  { slug: "water-cooler",   label: "Lifestyle",  color: "#0891b2" },
  { slug: "off-the-record", label: "Off-Record", color: "#be185d" },
];

const RECENT_KEY = "tbb:search:recent";
const MAX_RECENT = 5;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  try {
    const existing = loadRecent().filter((q) => q !== query);
    localStorage.setItem(RECENT_KEY, JSON.stringify([query, ...existing].slice(0, MAX_RECENT)));
  } catch {
    // localStorage unavailable in some contexts
  }
}

function PillarBadge({ slug, name }: { slug: string; name: string }) {
  const color = PILLARS.find((p) => p.slug === slug)?.color ?? "#6b7280";
  return (
    <span
      className="inline-block font-body text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 shrink-0"
      style={{ color, border: `1px solid ${color}`, opacity: 0.85 }}
    >
      {name}
    </span>
  );
}

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
  const posthog = usePostHog();
  const [query, setQuery]           = useState("");
  const [pillarFilter, setPillar]   = useState<string | null>(null);
  const [hits, setHits]             = useState<Hit[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [recent, setRecent]         = useState<string[]>([]);
  const inputRef  = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setRecent(loadRecent());
  }, []);

  const search = useCallback(async (q: string, pillar: string | null) => {
    if (q.length < 2) { setHits([]); setError(""); return; }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ q });
      if (pillar) params.set("pillar", pillar);
      const res  = await fetch(`/api/search?${params}`);
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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSelectedIdx(-1);
    if (query.trim().length < 2) { setHits([]); setError(""); return; }
    debounceRef.current = setTimeout(() => search(query.trim(), pillarFilter), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, pillarFilter, search]);

  function navigateTo(hit: Hit) {
    saveRecent(query.trim());
    setRecent(loadRecent());
    router.push(`/${hit.pillarSlug}/${hit.slug}`);
    onClose();
  }

  function submitSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    saveRecent(q);
    posthog?.capture("search_performed", { query: q, pillar: pillarFilter ?? "all", result_count: hits.length });
    const params = new URLSearchParams({ q });
    if (pillarFilter) params.set("pillar", pillarFilter);
    router.push(`/search?${params}`);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "Enter" && selectedIdx < 0) { submitSearch(); return; }
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

  const showResults  = query.length >= 2;
  const noResults    = showResults && !loading && hits.length === 0 && !error;
  const showRecent   = !showResults && recent.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(15,25,35,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Input bar */}
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
          {query && (
            <button
              onClick={submitSearch}
              className="hidden sm:flex items-center gap-1 font-body text-xs text-ink-muted dark:text-cream-300 hover:text-red-500 transition-colors duration-[120ms]"
              aria-label="See all results"
            >
              All results <ArrowRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-ink-muted dark:text-cream-300 hover:text-red-500 transition-colors duration-[120ms]"
            aria-label="Close search"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter pills */}
        <div className="site-container pb-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setPillar(null)}
            className={`shrink-0 font-body text-[11px] font-bold tracking-widest uppercase px-2.5 py-1 transition-colors duration-[80ms] ${
              pillarFilter === null
                ? "bg-navy-500 dark:bg-cream-100 text-cream-100 dark:text-navy-500"
                : "text-ink-muted dark:text-cream-300 hover:text-navy-500 dark:hover:text-cream-100"
            }`}
          >
            All
          </button>
          {PILLARS.map((p) => (
            <button
              key={p.slug}
              onClick={() => setPillar(pillarFilter === p.slug ? null : p.slug)}
              className="shrink-0 font-body text-[11px] font-bold tracking-widest uppercase px-2.5 py-1 transition-colors duration-[80ms]"
              style={
                pillarFilter === p.slug
                  ? { background: p.color, color: "#fff" }
                  : { color: p.color, border: `1px solid ${p.color}` }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results / recent panel */}
      <div
        className="bg-cream-100 dark:bg-navy-500 overflow-y-auto"
        style={{ maxHeight: "min(65vh, 560px)" }}
      >
        <div className="site-container py-2">

          {/* Skeleton loading */}
          {loading && hits.length === 0 && (
            <div className="space-y-3 py-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-14 h-10 bg-rule dark:bg-navy-400 shrink-0 hidden sm:block" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-rule dark:bg-navy-400 rounded w-3/4" />
                    <div className="h-2.5 bg-rule dark:bg-navy-400 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

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

          {/* Recent searches */}
          {showRecent && (
            <div className="py-2">
              <p className="font-body text-[10px] text-ink-faint dark:text-cream-500 uppercase tracking-widest mb-2">Recent</p>
              <ul>
                {recent.map((r) => (
                  <li key={r}>
                    <button
                      className="w-full text-left flex items-center gap-3 py-2.5 font-body text-sm text-ink-muted dark:text-cream-300 hover:text-navy-500 dark:hover:text-cream-100 transition-colors duration-[80ms]"
                      onClick={() => setQuery(r)}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
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

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <PillarBadge slug={hit.pillarSlug} name={hit.pillarName} />
                        </div>
                        <p className="font-headline font-bold text-sm text-navy-500 dark:text-cream-100 leading-snug mb-0.5 line-clamp-1">
                          <Highlight html={hit._highlightResult?.title?.value} fallback={hit.title} />
                        </p>
                        {hit.satiricalHeadline && (
                          <p className="font-prose italic text-xs text-ink-muted dark:text-cream-300 line-clamp-1 mb-0.5">
                            <Highlight html={hit._highlightResult?.satiricalHeadline?.value} fallback={hit.satiricalHeadline} />
                          </p>
                        )}
                        {hit.excerpt && (
                          <p className="font-body text-xs text-ink-faint dark:text-cream-500 line-clamp-1">
                            <Highlight html={hit._highlightResult?.excerpt?.value} fallback={hit.excerpt} />
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer hint */}
          {hits.length > 0 && (
            <div className="flex items-center justify-between py-2">
              <button
                onClick={submitSearch}
                className="font-body text-[11px] text-red-500 hover:text-navy-500 dark:hover:text-cream-100 transition-colors duration-[80ms]"
              >
                See all results for &ldquo;{query}&rdquo; →
              </button>
              <p className="font-body text-[10px] text-ink-faint dark:text-cream-500 select-none">
                ↑↓ navigate · Enter select · Esc close
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
