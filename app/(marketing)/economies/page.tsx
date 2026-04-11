import Link from "next/link";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { CONTINENTS } from "@/app/lib/mock-data";

export default function EconomiesPage() {
  return (
    <div style={{ background: "var(--cream)" }}>

      <div style={{ background: "var(--navy)", borderBottom: "3px solid var(--red)" }}>
        <div className="container-editorial py-4 flex items-center gap-3">
          <span className="eyebrow-gold text-2xs" style={{ color: "var(--gold)" }}>Coverage</span>
          <h1 className="text-lg font-serif font-bold" style={{ color: "var(--cream)" }}>
            Five Continents — Economic Intelligence
          </h1>
        </div>
      </div>

      <div className="container-editorial py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {CONTINENTS.map((c) => {
            const growthUp = !c.indicators.gdpGrowth.startsWith("-");
            return (
              <Link
                key={c.slug}
                href={`/economies/${c.slug}`}
                className="group flex flex-col p-6 transition-all hover:-translate-y-0.5"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderTop: "3px solid var(--red)",
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl">{c.flag}</span>
                  <span className="text-xs font-mono font-bold" style={{ color: "var(--navy)", fontFamily: "var(--font-jetbrains)" }}>
                    {c.gdp}
                  </span>
                </div>

                <h2 className="font-serif font-bold text-xl mb-2 group-hover:opacity-75 transition-opacity" style={{ color: "var(--navy)" }}>
                  {c.name}
                </h2>

                <p className="text-xs font-sans leading-relaxed mb-5 flex-1" style={{ color: "var(--ink-m)" }}>
                  {c.description}
                </p>

                {/* Indicators */}
                <div className="space-y-2 mb-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  {[
                    { label: "GDP Growth", value: c.indicators.gdpGrowth, up: growthUp },
                    { label: "Inflation",  value: c.indicators.inflation,  up: false },
                    { label: "Unemployment", value: c.indicators.unemployment, up: false },
                  ].map((ind) => (
                    <div key={ind.label} className="flex justify-between items-center">
                      <span className="text-2xs" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>{ind.label}</span>
                      <span className="text-2xs font-semibold flex items-center gap-0.5"
                        style={{ color: ind.up ? "#16a34a" : "var(--navy)", fontFamily: "var(--font-jetbrains)" }}>
                        {ind.up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {ind.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Key economies */}
                <div className="mb-4">
                  <p className="text-2xs mb-1.5" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>KEY ECONOMIES</p>
                  <div className="flex flex-wrap gap-1">
                    {c.keyEconomies.map((e) => (
                      <span key={e} className="text-2xs px-1.5 py-0.5 font-mono"
                        style={{ background: "var(--border)", color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>
                        {e}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-2xs font-semibold" style={{ color: "var(--red)", fontFamily: "var(--font-jetbrains)" }}>
                  Full briefing <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
