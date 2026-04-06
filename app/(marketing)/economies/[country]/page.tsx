import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { ECONOMIES, MOCK_ARTICLES, PILLARS, formatDateShort } from "@/app/lib/mock-data";

interface Props {
  params: Promise<{ country: string }>;
}

export function generateStaticParams() {
  return ECONOMIES.map((e) => ({ country: e.slug }));
}

const MOCK_MACRO: Record<string, {
  gdp: string; growth: string; inflation: string; unemployment: string;
  currency: string; rate: string;
  cultureIndex: { label: string; score: number; note: string }[];
}> = {
  default: {
    gdp: "—", growth: "—", inflation: "—", unemployment: "—", currency: "—", rate: "—",
    cultureIndex: [
      { label: "Work-Life Balance",    score: 6, note: "Dependent on manager lottery" },
      { label: "Meeting Culture",      score: 4, note: "Aggressive use of 'quick syncs'" },
      { label: "Email Response Time",  score: 7, note: "Within 24h, usually" },
      { label: "Dress Code Ambiguity", score: 5, note: "'Smart casual' never defined" },
      { label: "After-Work Drinks",    score: 7, note: "Expected but optional (it's not optional)" },
    ],
  },
  "united-states": {
    gdp: "$27.4T", growth: "2.8%", inflation: "3.2%", unemployment: "3.9%", currency: "USD", rate: "1.00",
    cultureIndex: [
      { label: "Work-Life Balance",    score: 5, note: "Work-life integration (they mean work)" },
      { label: "Meeting Culture",      score: 3, note: "30-minute blocks, 45 minutes actual" },
      { label: "Email Response Time",  score: 9, note: "Slack preferred; email = passive aggression" },
      { label: "Dress Code Ambiguity", score: 6, note: "Casual Friday is every day in tech" },
      { label: "After-Work Drinks",    score: 6, note: "Happy hour exists; leaving early does not" },
    ],
  },
  "united-kingdom": {
    gdp: "$3.1T", growth: "0.8%", inflation: "3.4%", unemployment: "4.2%", currency: "GBP", rate: "0.79",
    cultureIndex: [
      { label: "Work-Life Balance",    score: 7, note: "Pubs close at 11; plan accordingly" },
      { label: "Meeting Culture",      score: 6, note: "Tea is technically a meeting" },
      { label: "Email Response Time",  score: 6, note: "'I'll action that' — deadline unclear" },
      { label: "Dress Code Ambiguity", score: 5, note: "Smart casual, but make it grey" },
      { label: "After-Work Drinks",    score: 9, note: "Non-negotiable cultural institution" },
    ],
  },
  germany: {
    gdp: "$4.5T", growth: "-0.2%", inflation: "2.5%", unemployment: "5.8%", currency: "EUR", rate: "0.92",
    cultureIndex: [
      { label: "Work-Life Balance",    score: 9, note: "Do not email after 6pm. They will not reply." },
      { label: "Meeting Culture",      score: 8, note: "Agenda distributed 48h in advance" },
      { label: "Email Response Time",  score: 8, note: "Thorough, considered, slightly formal" },
      { label: "Dress Code Ambiguity", score: 9, note: "Zero ambiguity. Business means business." },
      { label: "After-Work Drinks",    score: 5, note: "Beer yes. Oversharing no." },
    ],
  },
  japan: {
    gdp: "$4.2T", growth: "1.9%", inflation: "2.8%", unemployment: "2.6%", currency: "JPY", rate: "149.50",
    cultureIndex: [
      { label: "Work-Life Balance",    score: 4, note: "Karoushi is a real word for a reason" },
      { label: "Meeting Culture",      score: 3, note: "Consensus requires many meetings about meetings" },
      { label: "Email Response Time",  score: 10, note: "Same day, formally formatted" },
      { label: "Dress Code Ambiguity", score: 10, note: "No ambiguity. Suit. Always." },
      { label: "After-Work Drinks",    score: 8, note: "Nomikai is mandatory bonding" },
    ],
  },
};

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ width: "10px", height: "10px", borderRadius: "1px",
            background: i < score ? "var(--red)" : "var(--border)" }} />
        ))}
      </div>
      <span className="text-2xs" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>
        {score}/10
      </span>
    </div>
  );
}

export default async function EconomyPage({ params }: Props) {
  const { country: countrySlug } = await params;
  const economy = ECONOMIES.find((e) => e.slug === countrySlug);
  if (!economy) notFound();

  const macro = MOCK_MACRO[countrySlug] ?? MOCK_MACRO["default"];
  const relatedArticles = MOCK_ARTICLES.slice(0, 4);
  const growthPositive = macro.growth !== "—" && !macro.growth.startsWith("-");

  return (
    <div style={{ background: "var(--cream)" }}>

      {/* Country header */}
      <div style={{ background: "var(--navy)", borderBottom: "3px solid var(--red)" }}>
        <div className="container-editorial py-10">
          <Link href="/economies" className="flex items-center gap-1 text-sm font-sans mb-5 transition-opacity hover:opacity-70" style={{ color: "rgba(245,240,232,0.5)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> All 30 Economies
          </Link>
          <div className="flex items-center gap-5">
            <span className="text-6xl">{economy.flag}</span>
            <div>
              <span className="eyebrow-gold" style={{ color: "var(--gold)" }}>{economy.region}</span>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold mt-1" style={{ color: "var(--cream)" }}>
                {economy.name}
              </h1>
              <p className="text-sm mt-1" style={{ color: "rgba(245,240,232,0.45)", fontFamily: "var(--font-jetbrains)" }}>
                {economy.code} · {macro.currency} · 1 USD = {macro.rate} {macro.currency}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-editorial py-10">

        {/* Key indicators strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 mb-10" style={{ border: "1px solid var(--border)" }}>
          {[
            { label: "GDP", value: macro.gdp, highlight: false },
            { label: "GDP Growth", value: macro.growth, highlight: true },
            { label: "Inflation", value: macro.inflation, highlight: false },
            { label: "Unemployment", value: macro.unemployment, highlight: false },
          ].map((stat) => (
            <div key={stat.label} className="p-5 border-r last:border-r-0" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="data-label mb-1">{stat.label}</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" style={{
                  color: stat.highlight ? (growthPositive ? "#16a34a" : "#dc2626") : "var(--navy)",
                  fontFamily: "var(--font-jetbrains)",
                }}>
                  {stat.value}
                </span>
                {stat.highlight && macro.growth !== "—" && (
                  growthPositive
                    ? <TrendingUp className="w-4 h-4" style={{ color: "#16a34a" }} />
                    : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />
                )}
              </div>
              <div className="text-2xs mt-1" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>World Bank · 2025</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Main content */}
          <div className="lg:col-span-2 space-y-10">

            <section>
              <div className="rule-thick mb-5" />
              <h2 className="eyebrow mb-4">Local Market Performance</h2>
              <div className="p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-sans italic" style={{ color: "var(--ink-m)" }}>
                  Live market data for {economy.name} connects in Phase 4 via Polygon.io.
                </p>
              </div>
            </section>

            <section>
              <div className="rule-thick mb-5" />
              <h2 className="eyebrow mb-5">Latest Coverage — {economy.name}</h2>
              <div className="space-y-0">
                {relatedArticles.map((article) => {
                  const pillar = PILLARS.find((p) => p.slug === article.pillar);
                  return (
                    <article key={article.slug} className="group border-b py-5" style={{ borderColor: "var(--border)" }}>
                      <Link href={`/${article.pillar}/${article.slug}`}>
                        <div className="flex gap-6 items-start">
                          <div className="flex-1 min-w-0">
                            {pillar && <span className={`pillar-badge text-2xs ${pillar.color}`}>{pillar.name}</span>}
                            <h3 className="text-base font-serif font-bold mt-1.5 leading-snug group-hover:opacity-70 transition-opacity" style={{ color: "var(--navy)" }}>
                              {article.title}
                            </h3>
                            <p className="text-sm font-serif italic mt-1" style={{ color: "var(--red)" }}>{article.satiricalHeadline}</p>
                            <p className="text-xs mt-2" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>
                              {formatDateShort(article.publishedAt)} · {article.readTime} min read
                            </p>
                          </div>
                          <div className="flex-shrink-0 hidden sm:block" style={{ width: "100px", height: "70px", background: "linear-gradient(135deg, var(--navy), #1a2a3a)", borderRadius: "2px" }} />
                        </div>
                      </Link>
                    </article>
                  );
                })}
              </div>
              <div className="text-center mt-6">
                <button className="btn-navy">Load more coverage</button>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside>
            <div className="lg:sticky lg:top-4 space-y-8">

              {/* Culture Index */}
              <div>
                <div className="rule-thick mb-4" />
                <h3 className="eyebrow mb-1">Corporate Culture Index</h3>
                <p className="text-xs font-sans mb-4 italic" style={{ color: "var(--ink-m)" }}>Unscientific. Accurate.</p>
                <div className="space-y-4">
                  {macro.cultureIndex.map((item) => (
                    <div key={item.label}>
                      <p className="text-xs font-sans font-medium mb-1" style={{ color: "var(--navy)" }}>{item.label}</p>
                      <ScoreBar score={item.score} />
                      <p className="text-2xs font-sans italic mt-1" style={{ color: "var(--ink-m)" }}>{item.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Other economies */}
              <div>
                <div className="rule-thick mb-4" />
                <p className="eyebrow mb-4">Other Economies</p>
                <div className="grid grid-cols-3 gap-2">
                  {ECONOMIES.filter((e) => e.slug !== countrySlug).slice(0, 9).map((e) => (
                    <Link key={e.slug} href={`/economies/${e.slug}`}
                      className="hover-card p-2 text-center block"
                      style={{ background: "var(--surface)", borderRadius: "2px" }}>
                      <div className="text-lg">{e.flag}</div>
                      <div className="text-2xs" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>{e.code}</div>
                    </Link>
                  ))}
                </div>
                <Link href="/economies" className="flex items-center gap-1 mt-4 text-xs transition-opacity hover:opacity-70" style={{ color: "var(--red)", fontFamily: "var(--font-jetbrains)" }}>
                  All 30 economies <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
