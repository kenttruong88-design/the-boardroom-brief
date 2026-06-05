"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import type { AlgoliaArticle } from "@/app/lib/algolia";

interface Hit extends AlgoliaArticle {
  _highlightResult?: {
    title?: { value: string };
    satiricalHeadline?: { value: string };
    excerpt?: { value: string };
  };
}

interface Props {
  query: string;
  pillar: string;
  page: number;
}

function Highlight({ html, fallback }: { html?: string; fallback: string }) {
  if (!html) return <>{fallback}</>;
  return (
    <span dangerouslySetInnerHTML={{ __html: html.replace(/<(?!\/?mark)[^>]+>/g, "") }} />
  );
}

export default function SearchResults({ query, pillar, page }: Props) {
  const [hits, setHits]       = useState<Hit[]>([]);
  const [nbHits, setNbHits]   = useState(0);
  const [nbPages, setNbPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ q: query, page: String(page) });
    if (pillar) params.set("pillar", pillar);

    fetch(`/api/search?${params}`)
      .then((r) => r.json())
      .then((data: { hits?: Hit[]; nbHits?: number; nbPages?: number; error?: string }) => {
        if (data.error) { setError(data.error); return; }
        setHits(data.hits ?? []);
        setNbHits(data.nbHits ?? 0);
        setNbPages(data.nbPages ?? 0);
      })
      .catch(() => setError("Search unavailable."))
      .finally(() => setLoading(false));
  }, [query, pillar, page]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-5 animate-pulse">
            <div className="w-24 h-16 bg-rule dark:bg-navy-400 shrink-0 hidden sm:block" />
            <div className="flex-1 space-y-2.5">
              <div className="h-4 bg-rule dark:bg-navy-400 rounded w-2/3" />
              <div className="h-3 bg-rule dark:bg-navy-400 rounded w-1/2" />
              <div className="h-3 bg-rule dark:bg-navy-400 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="font-body text-sm text-red-500 py-6">{error}</p>;
  }

  if (hits.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center text-ink-muted dark:text-cream-300 gap-3">
        <FileText className="w-8 h-8" />
        <p className="font-body">
          No results for <strong className="text-ink dark:text-cream-100">&ldquo;{query}&rdquo;</strong>
        </p>
        <p className="font-body text-sm">Try a broader search or different section filter.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-body text-sm text-ink-muted dark:text-cream-300 mb-6">
        {nbHits.toLocaleString()} result{nbHits !== 1 ? "s" : ""} for{" "}
        <strong className="text-ink dark:text-cream-100">&ldquo;{query}&rdquo;</strong>
      </p>

      <ul className="divide-y divide-rule dark:divide-rule-dark">
        {hits.map((hit) => (
          <li key={hit.objectID} className="py-5">
            <Link
              href={`/${hit.pillarSlug}/${hit.slug}`}
              className="flex gap-5 group no-underline"
            >
              {hit.heroImageUrl ? (
                <img
                  src={hit.heroImageUrl}
                  alt=""
                  className="w-24 h-16 object-cover shrink-0 hidden sm:block"
                  style={{ opacity: 0.9 }}
                />
              ) : (
                <div className="w-24 h-16 shrink-0 hidden sm:block" style={{ background: "var(--border)" }} />
              )}

              <div className="flex-1 min-w-0">
                <p className="font-body text-[11px] font-bold tracking-widest uppercase text-ink-muted dark:text-cream-300 mb-1">
                  {hit.pillarName}
                </p>
                <h2 className="font-headline font-bold text-base text-navy-500 dark:text-cream-100 leading-snug mb-1 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors duration-[120ms]">
                  <Highlight html={hit._highlightResult?.title?.value} fallback={hit.title} />
                </h2>
                {hit.satiricalHeadline && (
                  <p className="font-prose italic text-sm text-ink-muted dark:text-cream-300 mb-1 line-clamp-1">
                    <Highlight html={hit._highlightResult?.satiricalHeadline?.value} fallback={hit.satiricalHeadline} />
                  </p>
                )}
                <p className="font-body text-sm text-ink-faint dark:text-cream-500 line-clamp-2">
                  <Highlight html={hit._highlightResult?.excerpt?.value} fallback={hit.excerpt} />
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Pagination */}
      {nbPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-10">
          {page > 0 && (
            <a
              href={`/search?q=${encodeURIComponent(query)}${pillar ? `&pillar=${pillar}` : ""}&page=${page - 1}`}
              className="font-body text-sm text-ink-muted dark:text-cream-300 hover:text-red-500 no-underline"
            >
              ← Previous
            </a>
          )}
          <span className="font-body text-sm text-ink-faint dark:text-cream-500">
            Page {page + 1} of {nbPages}
          </span>
          {page < nbPages - 1 && (
            <a
              href={`/search?q=${encodeURIComponent(query)}${pillar ? `&pillar=${pillar}` : ""}&page=${page + 1}`}
              className="font-body text-sm text-ink-muted dark:text-cream-300 hover:text-red-500 no-underline"
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
