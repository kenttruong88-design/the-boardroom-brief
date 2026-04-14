"use client";

import { useEffect, useState, useMemo } from "react";
import { RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { createClient } from "@/app/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoryRow {
  id: string;
  headline: string;
  summary: string;
  url: string | null;
  source_name: string | null;
  pillar: string;
  region: string;
  countries: string[];
  market_symbols: string[];
  relevance_score: number;
  satirical_score: number;
  used_by_agent: string | null;
  used_at: string | null;
  fetched_at: string;
}

interface Stats {
  total: number;
  used: number;
  unused: number;
  avgRelevance: number;
  avgSatire: number;
}

interface LastRun {
  ran_at: string;
  stories_found: number;
  stories_stored: number;
  searches_run: number;
  duration_ms: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PILLAR_SLUGS = [
  "markets-floor",
  "macro-mondays",
  "c-suite-circus",
  "global-office",
  "water-cooler",
] as const;

const PILLAR_LABELS: Record<string, string> = {
  "markets-floor":  "Markets Floor",
  "macro-mondays":  "Macro Mondays",
  "c-suite-circus": "C-Suite Circus",
  "global-office":  "Global Office",
  "water-cooler":   "Water Cooler",
  "general":        "General",
};

const PILLAR_COLORS: Record<string, string> = {
  "markets-floor":  "#1d4ed8",
  "macro-mondays":  "#15803d",
  "c-suite-circus": "#7c3aed",
  "global-office":  "#b45309",
  "water-cooler":   "#be123c",
  "general":        "#6b6558",
};

type SortKey = "relevance" | "satire" | "recency" | "pillar";

type FilterTab = "all" | typeof PILLAR_SLUGS[number] | "unused";

// ── Sub-components ────────────────────────────────────────────────────────────

function PillarBadge({ pillar }: { pillar: string }) {
  const color = PILLAR_COLORS[pillar] ?? "#6b6558";
  const label = PILLAR_LABELS[pillar] ?? pillar;
  return (
    <span
      className="text-2xs font-mono font-semibold px-1.5 py-0.5"
      style={{
        color,
        border: `1px solid ${color}`,
        borderRadius: "2px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function ScorePip({ value, kind }: { value: number; kind: "rel" | "sat" }) {
  const high = kind === "rel" ? value >= 8 : value >= 7;
  const mid  = kind === "rel" ? value >= 6 : value >= 5;
  const color = high ? "#15803d" : mid ? "#d97706" : "#6b6558";
  return (
    <span className="text-xs font-mono font-semibold" style={{ color }}>
      {value}
    </span>
  );
}

function StoryCard({ story }: { story: StoryRow }) {
  const pillarColor = PILLAR_COLORS[story.pillar] ?? "#6b6558";
  const used = !!story.used_by_agent;

  return (
    <div
      className="p-4"
      style={{
        background: used ? "var(--surface)" : "var(--cream)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${used ? pillarColor : "var(--border)"}`,
        opacity: used ? 0.75 : 1,
      }}
    >
      {/* Headline */}
      <p
        className="font-sans font-medium leading-snug mb-1.5"
        style={{ fontSize: "13px", color: "var(--navy)" }}
      >
        {story.headline}
      </p>

      {/* Summary */}
      <p
        className="font-sans leading-relaxed mb-2.5 line-clamp-2"
        style={{ fontSize: "12px", color: "var(--ink-m)" }}
      >
        {story.summary}
      </p>

      {/* Chips row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {/* Source */}
        {story.source_name && (
          <span
            className="text-2xs font-mono px-1.5 py-0.5"
            style={{
              background: "var(--cream)",
              border: "1px solid var(--border)",
              color: "var(--ink-m)",
              borderRadius: "2px",
            }}
          >
            {story.source_name}
          </span>
        )}

        {/* Pillar */}
        <PillarBadge pillar={story.pillar} />

        {/* Region */}
        {story.region && story.region !== "global" && (
          <span
            className="text-2xs font-sans px-1.5 py-0.5"
            style={{
              background: "var(--cream)",
              border: "1px solid var(--border)",
              color: "var(--ink-m)",
              borderRadius: "2px",
            }}
          >
            {story.region}
          </span>
        )}

        {/* Countries */}
        {story.countries?.slice(0, 4).map((c) => (
          <span
            key={c}
            className="text-2xs font-mono"
            style={{ color: "var(--ink-m)" }}
          >
            {c}
          </span>
        ))}
      </div>

      {/* Score row */}
      <div className="flex items-center gap-3 mb-2" style={{ fontSize: "11px", color: "var(--ink-m)" }}>
        <span className="font-sans">
          relevance{" "}
          <ScorePip value={story.relevance_score} kind="rel" />
          <span style={{ color: "var(--border)" }}>/10</span>
        </span>
        <span style={{ color: "var(--border)" }}>·</span>
        <span className="font-sans">
          satire{" "}
          <ScorePip value={story.satirical_score} kind="sat" />
          <span style={{ color: "var(--border)" }}>/10</span>
        </span>
        {story.market_symbols?.length > 0 && (
          <>
            <span style={{ color: "var(--border)" }}>·</span>
            <span className="font-mono" style={{ color: "var(--ink-m)" }}>
              {story.market_symbols.slice(0, 3).join("  ")}
            </span>
          </>
        )}
      </div>

      {/* Status + link row */}
      <div className="flex items-center justify-between gap-2">
        {used ? (
          <span
            className="text-xs font-sans font-medium"
            style={{ color: pillarColor }}
          >
            Used by {story.used_by_agent}
          </span>
        ) : (
          <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>
            Available
          </span>
        )}

        {story.url && (
          <a
            href={story.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 transition-opacity hover:opacity-60"
            style={{ fontSize: "11px", color: "var(--ink-m)", textDecoration: "none" }}
          >
            <ExternalLink className="w-3 h-3" />
            Source
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewsFeedPage() {
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sortKey, setSortKey] = useState<SortKey>("relevance");

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string>("");

  // Auth check
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  // Fetch feed data
  function fetchFeed() {
    setLoading(true);
    setError("");
    fetch("/api/editorial/news-feed")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setStories(data.stories ?? []);
        setStats(data.stats ?? null);
        setLastRun(data.lastRun ?? null);
      })
      .catch(() => setError("Failed to load news feed."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (authed) fetchFeed();
    else if (authed === false) setLoading(false);
  }, [authed]);

  // Manual trigger
  async function handleRunIntel() {
    setRunning(true);
    setRunResult("");
    try {
      const res = await fetch("/api/editorial/run-intel", { method: "POST" });
      const data = await res.json() as { success?: boolean; storiesFound?: number; storiesStored?: number; error?: string };
      if (!res.ok) {
        setRunResult(`Error: ${data.error ?? "Unknown error"}`);
      } else {
        setRunResult(`Done — ${data.storiesFound ?? 0} found, ${data.storiesStored ?? 0} stored.`);
        fetchFeed();
      }
    } catch {
      setRunResult("Network error. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  // Filter + sort
  const displayStories = useMemo(() => {
    let filtered = stories;

    if (activeTab === "unused") {
      filtered = filtered.filter((s) => !s.used_by_agent);
    } else if (activeTab !== "all") {
      filtered = filtered.filter((s) => s.pillar === activeTab);
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "relevance") return b.relevance_score - a.relevance_score;
      if (sortKey === "satire")    return b.satirical_score - a.satirical_score;
      if (sortKey === "recency")   return new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime();
      if (sortKey === "pillar")    return (a.pillar ?? "").localeCompare(b.pillar ?? "");
      return 0;
    });

    return sorted;
  }, [stories, activeTab, sortKey]);

  // ── Early states ───────────────────────────────────────────────────────────

  if (authed === false) {
    return (
      <div className="container-editorial py-20 text-center">
        <p className="eyebrow mb-4">Access restricted</p>
        <h1 className="text-3xl font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>
          Sign in to access the news feed
        </h1>
        <a href="/login" className="btn-red">Sign in</a>
      </div>
    );
  }

  if (authed === null || (loading && stories.length === 0)) {
    return (
      <div className="container-editorial py-20 text-center">
        <p className="eyebrow-muted">Loading news feed…</p>
      </div>
    );
  }

  // ── Format last run time ───────────────────────────────────────────────────

  const lastRunTime = lastRun
    ? new Date(lastRun.ran_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
    : null;

  const lastRunDate = lastRun
    ? new Date(lastRun.ran_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="container-editorial py-10">

        {/* ── HEADER ── */}
        <div className="mb-6 pb-6" style={{ borderBottom: "2px solid var(--navy)" }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow mb-1">Editorial Dashboard</p>
              <h1 className="text-3xl font-serif font-bold" style={{ color: "var(--navy)" }}>
                News Feed
              </h1>
              {lastRun ? (
                <p className="text-sm font-sans mt-1" style={{ color: "var(--ink-m)" }}>
                  Fetched{" "}
                  <strong style={{ color: "var(--navy)" }}>{lastRun.stories_found}</strong>{" "}
                  stories at {lastRunTime}
                  <span style={{ color: "var(--border)" }}> · </span>
                  <span style={{ color: "var(--ink-m)" }}>{lastRunDate}</span>
                  <span style={{ color: "var(--border)" }}> · </span>
                  <span style={{ color: "var(--ink-m)" }}>{lastRun.searches_run} searches</span>
                </p>
              ) : (
                <p className="text-sm font-sans mt-1" style={{ color: "var(--ink-m)" }}>
                  No intel run found — trigger one below
                </p>
              )}
            </div>

            {/* Manual trigger */}
            <div className="flex-shrink-0 text-right">
              <button
                onClick={handleRunIntel}
                disabled={running}
                className="flex items-center gap-2 text-sm font-sans font-semibold px-4 py-2.5 transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{
                  background: "var(--navy)",
                  color: "var(--cream)",
                  borderRadius: "2px",
                  whiteSpace: "nowrap",
                }}
              >
                {running ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {running ? "Running…" : "Re-run news intelligence"}
              </button>
              {runResult && (
                <p
                  className="text-xs font-sans mt-1.5"
                  style={{
                    color: runResult.startsWith("Error") ? "var(--red)" : "#15803d",
                    textAlign: "right",
                  }}
                >
                  {runResult}
                </p>
              )}
              {running && (
                <p className="text-xs font-sans mt-1" style={{ color: "var(--ink-m)", textAlign: "right" }}>
                  Takes 2–3 minutes…
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── STATS BAR ── */}
        {stats && (
          <div
            className="grid grid-cols-5 gap-px mb-8"
            style={{ border: "1px solid var(--border)", background: "var(--border)" }}
          >
            {[
              { label: "Total stories",    value: stats.total },
              { label: "Used by agents",   value: stats.used,          color: "#1d4ed8" },
              { label: "Unused",           value: stats.unused,         color: "var(--ink-m)" },
              { label: "Avg relevance",    value: `${stats.avgRelevance}/10`, color: stats.avgRelevance >= 7 ? "#15803d" : "var(--navy)" },
              { label: "Avg satire",       value: `${stats.avgSatire}/10`,    color: stats.avgSatire >= 6 ? "#7c3aed" : "var(--navy)" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="text-center py-4"
                style={{ background: "var(--surface)" }}
              >
                <div
                  className="text-xl font-serif font-bold mb-0.5"
                  style={{ color: color ?? "var(--navy)" }}
                >
                  {value}
                </div>
                <div className="text-2xs font-sans uppercase tracking-wide" style={{ color: "var(--ink-m)" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── FILTER TABS + SORT ── */}
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1">
            {(["all", ...PILLAR_SLUGS, "unused"] as FilterTab[]).map((tab) => {
              const label =
                tab === "all"    ? "All" :
                tab === "unused" ? "Unused only" :
                PILLAR_LABELS[tab] ?? tab;
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="text-xs font-sans px-3 py-1.5 transition-all"
                  style={{
                    background:    active ? "var(--navy)" : "transparent",
                    color:         active ? "var(--cream)" : "var(--ink-m)",
                    border:        `1px solid ${active ? "var(--navy)" : "var(--border)"}`,
                    borderRadius:  "2px",
                    fontWeight:    active ? "600" : "400",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>Sort:</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="text-xs font-sans px-2 py-1.5"
              style={{
                background: "var(--cream)",
                border: "1px solid var(--border)",
                color: "var(--navy)",
                borderRadius: "2px",
                outline: "none",
              }}
            >
              <option value="relevance">By relevance</option>
              <option value="satire">By satire score</option>
              <option value="recency">By recency</option>
              <option value="pillar">By pillar</option>
            </select>
          </div>
        </div>

        {/* Story count */}
        <p className="text-xs font-sans mb-4" style={{ color: "var(--ink-m)" }}>
          {displayStories.length} {displayStories.length === 1 ? "story" : "stories"}
          {activeTab !== "all" ? ` · filtered` : ""}
        </p>

        {/* ── ERROR ── */}
        {error && (
          <div
            className="p-4 mb-6 text-sm font-sans"
            style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "var(--red)" }}
          >
            {error}
          </div>
        )}

        {/* ── STORY GRID ── */}
        {displayStories.length === 0 ? (
          <div
            className="py-16 text-center"
            style={{ border: "1px solid var(--border)" }}
          >
            <p className="eyebrow-muted mb-2">No stories found</p>
            <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>
              {activeTab === "unused"
                ? "All stories have been used by agents."
                : stories.length === 0
                  ? "Run the news intelligence agent to populate the feed."
                  : "No stories match this filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
