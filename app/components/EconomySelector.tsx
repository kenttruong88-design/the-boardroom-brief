"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

interface Economy {
  slug: string;
  name: string;
  region: string;
  code: string;
  flag: string;
}

interface Props {
  economies: Economy[];
}

const REGIONS = ["Americas", "Europe", "Asia-Pacific", "Middle East & Africa"];

export default function EconomySelector({ economies }: Props) {
  const [query, setQuery] = useState("");
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = economies;
    if (activeRegion) list = list.filter((e) => e.region === activeRegion);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q));
    }
    return list;
  }, [economies, query, activeRegion]);

  const grouped = useMemo(() => {
    if (query.trim() || activeRegion) return null; // flat list when searching/filtering
    return REGIONS.map((region) => ({
      region,
      economies: economies.filter((e) => e.region === region),
    }));
  }, [economies, query, activeRegion]);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--ink-m)" }} />
          <input
            type="text"
            placeholder="Search economies…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-xs font-sans pl-8 pr-3 py-2 outline-none w-48"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink)", borderRadius: "2px" }}
          />
        </div>

        {/* Region filters */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveRegion(null)}
            className="text-2xs font-mono px-3 py-1.5 transition-colors"
            style={{
              background: activeRegion === null ? "var(--navy)" : "var(--surface)",
              color: activeRegion === null ? "var(--cream)" : "var(--ink-m)",
              border: "1px solid var(--border)",
              borderRadius: "2px",
              fontFamily: "var(--font-jetbrains)",
            }}
          >
            All
          </button>
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setActiveRegion(activeRegion === r ? null : r)}
              className="text-2xs font-mono px-3 py-1.5 transition-colors"
              style={{
                background: activeRegion === r ? "var(--navy)" : "var(--surface)",
                color: activeRegion === r ? "var(--cream)" : "var(--ink-m)",
                border: "1px solid var(--border)",
                borderRadius: "2px",
                fontFamily: "var(--font-jetbrains)",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped grid (default) */}
      {grouped ? (
        <div className="space-y-6">
          {grouped.map(({ region, economies: regionEcons }) => (
            <div key={region}>
              <p className="eyebrow-muted text-2xs mb-3" style={{ fontFamily: "var(--font-jetbrains)" }}>
                {region}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {regionEcons.map((e) => (
                  <EconomyCard key={e.slug} economy={e} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Flat filtered grid
        <div>
          {filtered.length === 0 ? (
            <p className="text-sm font-sans py-6 text-center" style={{ color: "var(--ink-m)" }}>
              No economies found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {filtered.map((e) => (
                <EconomyCard key={e.slug} economy={e} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EconomyCard({ economy }: { economy: Economy }) {
  return (
    <Link
      href={`/economies/${economy.slug}`}
      className="group flex flex-col items-center gap-1.5 py-3 px-2 text-center transition-all hover:scale-105"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "2px",
      }}
    >
      <span className="text-2xl leading-none">{economy.flag}</span>
      <span className="text-2xs font-sans leading-tight" style={{ color: "var(--ink)" }}>
        {economy.name}
      </span>
      <span className="text-2xs font-mono" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>
        {economy.code}
      </span>
    </Link>
  );
}
