import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown, Mic2 } from "lucide-react";
import { CONTINENTS, MOCK_ARTICLES, PILLARS, formatDateShort } from "@/app/lib/mock-data";
import { Clock } from "lucide-react";

export const revalidate = 3600;

interface Props {
  params: Promise<{ country: string }>;
}

export function generateStaticParams() {
  return CONTINENTS.map((c) => ({ country: c.slug }));
}

function PillarBadge({ pillar }: { pillar: string }) {
  const p = PILLARS.find((x) => x.slug === pillar);
  if (!p) return null;
  return <span className={`pillar-badge text-2xs ${p.color}`}>{p.name}</span>;
}

const CONTINENT_DETAIL: Record<string, {
  overview: string;
  outlook: string;
  risks: string[];
  opportunities: string[];
  centralBank: string;
  currency: string;
  tradeBloc: string;
}> = {
  "north-america": {
    overview: "North America remains the world's largest economic zone by nominal GDP, anchored by the United States Federal Reserve's monetary policy and a labour market that has defied textbook predictions for three consecutive years. Canada's resource sector faces commodity price volatility while Mexico's nearshoring boom continues to attract manufacturing investment at scale.",
    outlook: "Soft landing is the base case, but the path is narrowing. Rate cuts are priced in but not guaranteed. Corporate earnings have held up better than feared, which may itself become a problem if it delays necessary Fed easing.",
    risks: ["Political transition risk in the US", "Commercial real estate overhang", "Consumer credit stress below the median income line", "Canada housing correction deepening"],
    opportunities: ["AI infrastructure buildout continuing", "Nearshoring manufacturing in Mexico", "Clean energy transition capital deployment", "Financial services consolidation"],
    centralBank: "Federal Reserve (USD) · Bank of Canada (CAD) · Banxico (MXN)",
    currency: "USD / CAD / MXN",
    tradeBloc: "USMCA",
  },
  "europe": {
    overview: "The European economic story in 2026 is one of structural adjustment rather than cyclical recovery. Germany's industrial model — built on cheap Russian energy and Chinese demand — faces a fundamental rethink. Meanwhile, the ECB is navigating disinflation while southern European economies, paradoxically, are outperforming.",
    outlook: "Stagnation with pockets of resilience. Defence spending is becoming a meaningful GDP contributor. The AI Act creates compliance complexity but may also accelerate domestic investment in European AI champions.",
    risks: ["German industrial contraction becoming entrenched", "Energy price vulnerability", "Populist political risk in France and Italy", "Banking sector exposure to commercial property"],
    opportunities: ["Defence sector investment surge", "European semiconductor sovereignty", "Tourism and services resilience", "Eastern Europe manufacturing growth"],
    centralBank: "European Central Bank (EUR) · Bank of England (GBP) · Swiss National Bank (CHF)",
    currency: "EUR / GBP / CHF / SEK",
    tradeBloc: "European Union / Single Market",
  },
  "asia-pacific": {
    overview: "Asia-Pacific contains the world's growth engine but also its most complex risk landscape. China's post-pandemic recovery remains uneven — manufacturing and exports are strong, domestic consumption is not. India is the structural growth story of the decade. Japan's inflation awakening is reshaping a generation of investment assumptions.",
    outlook: "The region will account for over 60% of global growth in 2026. The China-US technology decoupling is accelerating supply chain shifts that benefit Vietnam, India, and Mexico simultaneously. Japan's gradual rate normalisation is the most consequential central bank story outside the Fed.",
    risks: ["China property sector contagion", "Taiwan Strait geopolitical risk", "Yen carry trade unwinding", "ASEAN political instability"],
    opportunities: ["India's demographic and digital dividend", "Semiconductor supply chain diversification", "Japan corporate governance reforms", "Southeast Asia consumer growth"],
    centralBank: "People's Bank of China · Bank of Japan · Reserve Bank of India · RBA",
    currency: "CNY / JPY / INR / KRW / AUD / SGD",
    tradeBloc: "RCEP / CPTPP",
  },
  "middle-east": {
    overview: "The Gulf states are executing the most ambitious economic transformation in modern history, deploying sovereign wealth at scale to diversify before the energy transition structurally erodes oil revenues. Saudi Vision 2030 is ahead of schedule in some sectors, behind in others. The UAE has become a global financial hub by design.",
    outlook: "High oil prices provide a fiscal buffer but also reduce urgency for reform. Sovereign wealth funds are increasingly consequential in global capital markets. The region's geopolitical risk premium remains elevated but has been largely priced in by regional markets.",
    risks: ["Oil price volatility and fiscal dependence", "Regional conflict escalation", "Executional risk in mega-projects", "Tourism and real estate overheating"],
    opportunities: ["Sovereign wealth fund deployment", "Financial services hub competition", "Renewable energy transition", "Tourism infrastructure"],
    centralBank: "Saudi Central Bank (SAMA) · Central Bank of UAE",
    currency: "SAR (USD peg) / AED (USD peg) / TRY",
    tradeBloc: "Gulf Cooperation Council (GCC)",
  },
  "africa": {
    overview: "Africa's economic narrative in 2026 is one of divergence at scale. Nigeria, the continent's largest economy by GDP, is undergoing painful but necessary monetary reforms. Ethiopia and Kenya are the growth outliers. South Africa's structural challenges — energy supply, logistics, political gridlock — continue to weigh on an otherwise resource-rich economy.",
    outlook: "The continent's demographic advantage will take decades to translate into economic output. In the near term, commodity exposure, dollar-denominated debt, and infrastructure gaps constrain growth below potential. The African Continental Free Trade Area remains transformative in theory.",
    risks: ["Dollar-denominated debt burden as USD strengthens", "Commodity price dependence", "Political instability in key markets", "Infrastructure financing gap"],
    opportunities: ["Demographic dividend (youngest population globally)", "AfCFTA implementation", "Critical minerals demand from energy transition", "Mobile financial services leapfrogging"],
    centralBank: "South African Reserve Bank · Central Bank of Nigeria · Central Bank of Egypt",
    currency: "ZAR / NGN / KES / EGP / ETB",
    tradeBloc: "African Continental Free Trade Area (AfCFTA)",
  },
};

export default async function ContinentPage({ params }: Props) {
  const { country: slug } = await params;
  const continent = CONTINENTS.find((c) => c.slug === slug);
  if (!continent) notFound();

  const detail = CONTINENT_DETAIL[slug] ?? CONTINENT_DETAIL["north-america"];
  const growthUp = !continent.indicators.gdpGrowth.startsWith("-");

  // Relevant mock articles (use all pillars as proxy)
  const articles = MOCK_ARTICLES.slice(0, 6);

  return (
    <div style={{ background: "var(--cream)" }}>

      {/* Continent header */}
      <div style={{ background: "var(--navy)", borderBottom: "3px solid var(--red)" }}>
        <div className="container-editorial py-10">
          <Link href="/economies" className="flex items-center gap-1 text-sm font-sans mb-5 transition-opacity hover:opacity-70" style={{ color: "rgba(245,240,232,0.5)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> All Continents
          </Link>
          <div className="flex items-center gap-5">
            <span className="text-6xl">{continent.flag}</span>
            <div>
              <span className="eyebrow-gold text-2xs tracking-widest uppercase" style={{ color: "var(--gold)" }}>
                Continental Briefing
              </span>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold mt-1" style={{ color: "var(--cream)" }}>
                {continent.name}
              </h1>
              <p className="text-sm mt-1 font-sans" style={{ color: "rgba(245,240,232,0.5)" }}>
                GDP {continent.gdp} · {detail.tradeBloc}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-editorial py-10">

        {/* Key indicators strip */}
        <div className="grid grid-cols-3 mb-10" style={{ border: "1px solid var(--border)" }}>
          {[
            { label: "GDP Growth",   value: continent.indicators.gdpGrowth, isGrowth: true },
            { label: "Inflation",    value: continent.indicators.inflation,  isGrowth: false },
            { label: "Unemployment", value: continent.indicators.unemployment, isGrowth: false },
          ].map((stat) => (
            <div key={stat.label} className="p-5 border-r last:border-r-0" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="data-label mb-1">{stat.label}</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" style={{
                  color: stat.isGrowth ? (growthUp ? "#ea580c" : "#dc2626") : "var(--navy)",
                  fontFamily: "var(--font-jetbrains)",
                }}>
                  {stat.value}
                </span>
                {stat.isGrowth && (
                  growthUp
                    ? <TrendingUp className="w-4 h-4" style={{ color: "#ea580c" }} />
                    : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />
                )}
              </div>
              <div className="text-2xs mt-1" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>
                Composite estimate · 2026
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Main */}
          <div className="lg:col-span-2 space-y-10">

            {/* Overview */}
            <section>
              <div className="rule-thick mb-5" />
              <h2 className="eyebrow mb-4">Overview</h2>
              <p className="font-sans text-base leading-relaxed" style={{ color: "var(--ink)" }}>
                {detail.overview}
              </p>
            </section>

            {/* Outlook */}
            <section>
              <div className="rule-thick mb-5" />
              <h2 className="eyebrow mb-4">2026 Outlook</h2>
              <blockquote className="pull-quote">{detail.outlook}</blockquote>
            </section>

            {/* Risks & Opportunities */}
            <section>
              <div className="rule-thick mb-5" />
              <h2 className="eyebrow mb-5">Risk / Opportunity Matrix</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-mono font-semibold mb-3 uppercase tracking-wider" style={{ color: "#dc2626", fontFamily: "var(--font-jetbrains)" }}>
                    Key Risks
                  </p>
                  <ul className="space-y-2">
                    {detail.risks.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-sm font-sans" style={{ color: "var(--ink)" }}>
                        <span style={{ color: "#dc2626", marginTop: "2px" }}>↓</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-mono font-semibold mb-3 uppercase tracking-wider" style={{ color: "#ea580c", fontFamily: "var(--font-jetbrains)" }}>
                    Opportunities
                  </p>
                  <ul className="space-y-2">
                    {detail.opportunities.map((o) => (
                      <li key={o} className="flex items-start gap-2 text-sm font-sans" style={{ color: "var(--ink)" }}>
                        <span style={{ color: "#ea580c", marginTop: "2px" }}>↑</span> {o}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Key economies */}
            <section>
              <div className="rule-thick mb-5" />
              <h2 className="eyebrow mb-4">Key Economies</h2>
              <div className="flex flex-wrap gap-2">
                {continent.keyEconomies.map((e) => (
                  <span key={e} className="px-3 py-1.5 text-sm font-sans font-medium" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--navy)" }}>
                    {e}
                  </span>
                ))}
              </div>
            </section>

            {/* Related coverage */}
            <section>
              <div className="rule-thick mb-5" />
              <h2 className="eyebrow mb-5">Related Coverage</h2>
              <div className="space-y-5">
                {articles.map((article) => (
                  <article key={article.slug} className="group border-b pb-5" style={{ borderColor: "var(--border)" }}>
                    <Link href={`/${article.pillar}/${article.slug}`}>
                      <PillarBadge pillar={article.pillar} />
                      <h3 className="text-base font-serif font-bold mt-1.5 leading-snug group-hover:opacity-70 transition-opacity" style={{ color: "var(--navy)" }}>
                        {article.title}
                      </h3>
                      <p className="text-xs font-serif italic mt-1" style={{ color: "var(--red)" }}>
                        {article.satiricalHeadline}
                      </p>
                      <div className="flex items-center gap-3 text-xs mt-2" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>
                        <span>{formatDateShort(article.publishedAt)}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {article.readTime} min</span>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside>
            <div className="lg:sticky lg:top-4 space-y-8">

              {/* Central bank & currency */}
              <div>
                <div className="rule-thick mb-4" />
                <h3 className="eyebrow mb-4">Monetary Landscape</h3>
                <div className="space-y-3" style={{ border: "1px solid var(--border)" }}>
                  <div className="p-4" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                    <p className="data-label mb-1">Central Banks</p>
                    <p className="text-xs font-sans" style={{ color: "var(--ink)" }}>{detail.centralBank}</p>
                  </div>
                  <div className="p-4" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                    <p className="data-label mb-1">Currencies</p>
                    <p className="text-xs font-mono" style={{ color: "var(--ink)", fontFamily: "var(--font-jetbrains)" }}>{detail.currency}</p>
                  </div>
                  <div className="p-4" style={{ background: "var(--surface)" }}>
                    <p className="data-label mb-1">Trade Bloc</p>
                    <p className="text-xs font-sans" style={{ color: "var(--ink)" }}>{detail.tradeBloc}</p>
                  </div>
                </div>
              </div>

              {/* Other continents */}
              <div>
                <div className="rule-thick mb-4" />
                <h3 className="eyebrow mb-4">Other Continents</h3>
                <div className="space-y-2">
                  {CONTINENTS.filter((c) => c.slug !== slug).map((c) => (
                    <Link key={c.slug} href={`/economies/${c.slug}`}
                      className="flex items-center gap-3 p-3 transition-colors hover:opacity-70"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <span className="text-xl">{c.flag}</span>
                      <div>
                        <p className="text-sm font-serif font-bold" style={{ color: "var(--navy)" }}>{c.name}</p>
                        <p className="text-2xs font-mono" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>GDP {c.gdp}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Newsletter */}
              <div className="p-6" style={{ background: "var(--navy)" }}>
                <p className="eyebrow-gold mb-2 text-2xs" style={{ color: "var(--gold)" }}>Daily Brief</p>
                <h3 className="font-serif font-bold mb-2" style={{ color: "var(--cream)" }}>Continental Intelligence</h3>
                <p className="text-xs font-sans mb-4" style={{ color: "rgba(245,240,232,0.55)" }}>Every morning. Five continents. Under 5 minutes.</p>
                <form className="space-y-2">
                  <input type="email" placeholder="your@email.com"
                    className="w-full text-sm font-sans px-3 py-2.5 outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "var(--cream)", borderRadius: "2px" }} />
                  <button type="submit" className="btn-red w-full text-sm">Subscribe</button>
                </form>
              </div>

            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
