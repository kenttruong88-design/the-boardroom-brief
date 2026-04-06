import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { ECONOMIES, MOCK_ARTICLES, PILLARS, formatDateShort } from "@/app/lib/mock-data";
import { getArticlesByCountry } from "@/app/lib/queries";
import { createAdminClient } from "@/app/lib/supabase";

export const revalidate = 3600; // World Bank data changes infrequently

interface Props {
  params: Promise<{ country: string }>;
}

export function generateStaticParams() {
  return ECONOMIES.map((e) => ({ country: e.slug }));
}

// ── World Bank indicator codes ────────────────────────────────────────────────
const WB_INDICATORS = {
  gdpCurrent:    "NY.GDP.MKTP.CD",  // GDP (current USD)
  gdpGrowth:     "NY.GDP.MKTP.KD.ZG", // GDP growth (%)
  inflation:     "FP.CPI.TOTL.ZG",  // Inflation (%)
  unemployment:  "SL.UEM.TOTL.ZS",  // Unemployment (% of labour force)
};

async function fetchWorldBank(countryCode: string, indicator: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json&mrv=1`,
      { next: { revalidate: 86400 } } // 24h cache
    );
    if (!res.ok) return "—";
    const data = await res.json();
    const value = data?.[1]?.[0]?.value;
    if (value == null) return "—";
    return value as string;
  } catch {
    return "—";
  }
}

function formatGdp(raw: string): string {
  if (raw === "—") return "—";
  const n = parseFloat(raw);
  if (isNaN(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(0)}B`;
  return `$${n.toFixed(0)}`;
}

function formatPct(raw: string): string {
  if (raw === "—") return "—";
  const n = parseFloat(raw);
  if (isNaN(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ── Corporate Culture Index (hardcoded, dry-wit) ──────────────────────────────
const CULTURE_INDEX: Record<string, { label: string; score: number; note: string }[]> = {
  default: [
    { label: "Work-Life Balance",    score: 6, note: "Dependent on manager lottery" },
    { label: "Meeting Culture",      score: 4, note: "Aggressive use of 'quick syncs'" },
    { label: "Email Response Time",  score: 7, note: "Within 24h, usually" },
    { label: "Dress Code Ambiguity", score: 5, note: "'Smart casual' never defined" },
    { label: "After-Work Drinks",    score: 7, note: "Expected but optional (it's not optional)" },
  ],
  "united-states": [
    { label: "Work-Life Balance",    score: 5, note: "Work-life integration (they mean work)" },
    { label: "Meeting Culture",      score: 3, note: "30-minute blocks, 45 minutes actual" },
    { label: "Email Response Time",  score: 9, note: "Slack preferred; email = passive aggression" },
    { label: "Dress Code Ambiguity", score: 6, note: "Casual Friday is every day in tech" },
    { label: "After-Work Drinks",    score: 6, note: "Happy hour exists; leaving early does not" },
  ],
  "united-kingdom": [
    { label: "Work-Life Balance",    score: 7, note: "Pubs close at 11; plan accordingly" },
    { label: "Meeting Culture",      score: 6, note: "Tea is technically a meeting" },
    { label: "Email Response Time",  score: 6, note: "'I'll action that' — deadline unclear" },
    { label: "Dress Code Ambiguity", score: 5, note: "Smart casual, but make it grey" },
    { label: "After-Work Drinks",    score: 9, note: "Non-negotiable cultural institution" },
  ],
  germany: [
    { label: "Work-Life Balance",    score: 9, note: "Do not email after 6pm. They will not reply." },
    { label: "Meeting Culture",      score: 8, note: "Agenda distributed 48h in advance" },
    { label: "Email Response Time",  score: 8, note: "Thorough, considered, slightly formal" },
    { label: "Dress Code Ambiguity", score: 9, note: "Zero ambiguity. Business means business." },
    { label: "After-Work Drinks",    score: 5, note: "Beer yes. Oversharing no." },
  ],
  japan: [
    { label: "Work-Life Balance",    score: 4, note: "Karoushi is a real word for a reason" },
    { label: "Meeting Culture",      score: 3, note: "Consensus requires many meetings about meetings" },
    { label: "Email Response Time",  score: 10, note: "Same day, formally formatted" },
    { label: "Dress Code Ambiguity", score: 10, note: "No ambiguity. Suit. Always." },
    { label: "After-Work Drinks",    score: 8, note: "Nomikai is mandatory bonding" },
  ],
  france: [
    { label: "Work-Life Balance",    score: 9, note: "35-hour week is law; lunch is religion" },
    { label: "Meeting Culture",      score: 5, note: "Philosophical in tone, vague on outcomes" },
    { label: "Email Response Time",  score: 4, note: "August is a blackout month by national decree" },
    { label: "Dress Code Ambiguity", score: 7, note: "Effortlessly chic, or at least trying" },
    { label: "After-Work Drinks",    score: 8, note: "Aperitivo is non-negotiable" },
  ],
  china: [
    { label: "Work-Life Balance",    score: 3, note: "996 is a lifestyle, not a complaint" },
    { label: "Meeting Culture",      score: 5, note: "Decisions happen before the meeting" },
    { label: "Email Response Time",  score: 8, note: "WeChat preferred; 24/7 availability implied" },
    { label: "Dress Code Ambiguity", score: 6, note: "Tech casual to formal, geography-dependent" },
    { label: "After-Work Drinks",    score: 7, note: "Baijiu tolerance is a career asset" },
  ],
  "south-korea": [
    { label: "Work-Life Balance",    score: 4, note: "Leaving before the boss is considered rude" },
    { label: "Meeting Culture",      score: 5, note: "Hierarchy determines speaking order" },
    { label: "Email Response Time",  score: 9, note: "KakaoTalk at 11pm is normal" },
    { label: "Dress Code Ambiguity", score: 8, note: "Presentation matters enormously" },
    { label: "After-Work Drinks",    score: 9, note: "Hoesik is a team sport" },
  ],
};

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            width: "10px", height: "10px", borderRadius: "1px",
            background: i < score ? "var(--red)" : "var(--border)",
          }} />
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

  // Fetch World Bank indicators in parallel
  const [gdpRaw, growthRaw, inflationRaw, unemploymentRaw] = await Promise.all([
    fetchWorldBank(economy.code, WB_INDICATORS.gdpCurrent),
    fetchWorldBank(economy.code, WB_INDICATORS.gdpGrowth),
    fetchWorldBank(economy.code, WB_INDICATORS.inflation),
    fetchWorldBank(economy.code, WB_INDICATORS.unemployment),
  ]);

  const gdp          = formatGdp(gdpRaw);
  const growth       = formatPct(growthRaw);
  const inflation    = formatPct(inflationRaw);
  const unemployment = growthRaw === "—" ? "—" : `${parseFloat(unemploymentRaw).toFixed(1)}%`;
  const growthPositive = growth !== "—" && !growth.startsWith("-") && !growth.startsWith("+0.0");

  // Fetch live market data for this economy from market_cache
  let liveMarket: { symbol: string; name: string; price: number; changePct: number } | null = null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("market_cache")
      .select("symbol, name, price, change_pct")
      .eq("economy_id", countrySlug)
      .order("pulled_at", { ascending: false })
      .limit(1)
      .single();
    if (data) {
      liveMarket = { symbol: data.symbol, name: data.name, price: data.price, changePct: data.change_pct };
    }
  } catch { /* no live data yet */ }

  // Fetch articles from Sanity, fall back to mock
  let articles = MOCK_ARTICLES.slice(0, 4);
  try {
    const sanityArticles = await getArticlesByCountry(countrySlug, 12);
    if (sanityArticles.length > 0) {
      articles = sanityArticles.map((a) => ({
        slug: a.slug.current,
        title: a.title,
        satiricalHeadline: a.satiricalHeadline ?? "",
        excerpt: a.excerpt ?? "",
        publishedAt: a.publishedAt,
        readTime: a.readTime ?? 5,
        pillar: a.pillar?.slug?.current ?? "markets-floor",
        author: a.author?.name ?? "Staff Writer",
        featured: false,
      })) as typeof MOCK_ARTICLES;
    }
  } catch { /* use mock */ }

  const cultureIndex = CULTURE_INDEX[countrySlug] ?? CULTURE_INDEX.default;

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
                {economy.code}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-editorial py-10">

        {/* Key indicators strip — World Bank data */}
        <div className="grid grid-cols-2 sm:grid-cols-4 mb-10" style={{ border: "1px solid var(--border)" }}>
          {[
            { label: "GDP",          value: gdp,          highlight: false },
            { label: "GDP Growth",   value: growth,       highlight: true  },
            { label: "Inflation",    value: inflation,    highlight: false },
            { label: "Unemployment", value: unemployment, highlight: false },
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
                {stat.highlight && growth !== "—" && (
                  growthPositive
                    ? <TrendingUp className="w-4 h-4" style={{ color: "#16a34a" }} />
                    : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />
                )}
              </div>
              <div className="text-2xs mt-1" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>
                World Bank · latest available
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Main content */}
          <div className="lg:col-span-2 space-y-10">

            {/* Local market performance */}
            <section>
              <div className="rule-thick mb-5" />
              <h2 className="eyebrow mb-4">Local Market Performance</h2>
              {liveMarket ? (
                <div
                  className="flex items-center justify-between p-5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div>
                    <p className="data-label mb-1">{liveMarket.symbol}</p>
                    <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>{liveMarket.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: "var(--navy)", fontFamily: "var(--font-jetbrains)" }}>
                      {liveMarket.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </p>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: liveMarket.changePct >= 0 ? "#16a34a" : "#dc2626", fontFamily: "var(--font-jetbrains)" }}
                    >
                      {liveMarket.changePct >= 0 ? "▲" : "▼"} {Math.abs(liveMarket.changePct).toFixed(2)}%
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <p className="text-sm font-sans italic" style={{ color: "var(--ink-m)" }}>
                    Live market data syncs every 15 minutes via the market pipeline.
                  </p>
                </div>
              )}
            </section>

            {/* Latest coverage */}
            <section>
              <div className="rule-thick mb-5" />
              <h2 className="eyebrow mb-5">Latest Coverage — {economy.name}</h2>
              <div className="space-y-0">
                {articles.map((article) => {
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
                  {cultureIndex.map((item) => (
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
