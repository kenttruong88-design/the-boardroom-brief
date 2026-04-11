"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";

interface Continent {
  slug: string;
  name: string;
  flag: string;
  gdp: string;
  color: string;
  description: string;
  keyEconomies: string[];
  indicators: { gdpGrowth: string; inflation: string; unemployment: string };
}

interface Props {
  continents: Continent[];
}

export default function EconomySelector({ continents }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {continents.map((c) => {
        const growthUp = !c.indicators.gdpGrowth.startsWith("-");
        return (
          <Link
            key={c.slug}
            href={`/economies/${c.slug}`}
            className="group flex flex-col p-5 transition-all hover:-translate-y-0.5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderTop: `3px solid currentColor`,
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{c.flag}</span>
              <span className={`text-xs font-mono font-semibold ${c.color}`} style={{ fontFamily: "var(--font-jetbrains)" }}>
                {c.gdp}
              </span>
            </div>

            <h3 className="font-serif font-bold text-base mb-1 group-hover:opacity-75 transition-opacity" style={{ color: "var(--navy)" }}>
              {c.name}
            </h3>

            <p className="text-xs font-sans leading-relaxed mb-4 flex-1" style={{ color: "var(--ink-m)" }}>
              {c.description.split(",")[0]}…
            </p>

            {/* Key indicators */}
            <div className="space-y-1.5 mb-4">
              {[
                { label: "GDP Growth", value: c.indicators.gdpGrowth, up: growthUp },
                { label: "Inflation", value: c.indicators.inflation, up: false },
                { label: "Unemployment", value: c.indicators.unemployment, up: false },
              ].map((ind) => (
                <div key={ind.label} className="flex justify-between items-center">
                  <span className="text-2xs" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>
                    {ind.label}
                  </span>
                  <span className="text-2xs font-semibold flex items-center gap-0.5" style={{ color: ind.up ? "#ea580c" : "var(--navy)", fontFamily: "var(--font-jetbrains)" }}>
                    {ind.up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {ind.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Key economies */}
            <div className="flex flex-wrap gap-1 mb-3">
              {c.keyEconomies.slice(0, 3).map((e) => (
                <span key={e} className="text-2xs px-1.5 py-0.5 font-mono" style={{ background: "var(--border)", color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>
                  {e}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1 text-2xs font-semibold" style={{ color: "var(--red)", fontFamily: "var(--font-jetbrains)" }}>
              Full briefing <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
