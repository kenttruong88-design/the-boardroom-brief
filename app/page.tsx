import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";
import MarketTicker from "@/app/components/MarketTicker";
import { MOCK_ARTICLES, PILLARS, TICKER_DATA, ECONOMIES, formatDateShort } from "@/app/lib/mock-data";
import { getLatestArticles, type SanityArticle } from "@/app/lib/queries";
import { Clock, ArrowRight } from "lucide-react";

export const revalidate = 60;

// ── Inline components ──────────────────────────────────────────────

function PillarBadge({ pillar }: { pillar: string }) {
  const p = PILLARS.find((x) => x.slug === pillar);
  if (!p) return null;
  return (
    <span className={`pillar-badge text-2xs ${p.color}`}>{p.name}</span>
  );
}

function Meta({ date, readTime }: { date: string; readTime: number }) {
  return (
    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>
      <span>{formatDateShort(date)}</span>
      <span className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {readTime} min
      </span>
    </div>
  );
}

// Normalise a Sanity article into the same shape used in the template
function normaliseSanity(a: SanityArticle) {
  return {
    slug: a.slug.current,
    title: a.title,
    satiricalHeadline: a.satiricalHeadline ?? "",
    excerpt: a.excerpt ?? "",
    publishedAt: a.publishedAt,
    readTime: a.readTime ?? 5,
    pillar: a.pillar?.slug?.current ?? "markets-floor",
    coverImage: a.coverImage?.asset?.url ?? null,
  };
}

export default async function HomePage() {
  // Try Sanity first; fall back to mock data if CMS is empty
  let articles = MOCK_ARTICLES;
  try {
    const sanityArticles = await getLatestArticles(10);
    if (sanityArticles.length > 0) {
      articles = sanityArticles.map(normaliseSanity) as unknown as typeof MOCK_ARTICLES;
    }
  } catch {
    // Sanity unavailable — use mock data
  }

  const hero = articles[0];
  const secondary = articles.slice(1, 4);
  const spotlightEconomy = ECONOMIES.find((e) => e.slug === "united-states")!;

  return (
    <>
      <MarketTicker />
      <Navigation />

      <main style={{ background: "var(--cream)" }}>
        {/* Date bar */}
        <div className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="container-editorial py-1.5 flex items-center justify-between">
            <span className="eyebrow-muted">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
            <span className="eyebrow-muted hidden sm:block">Vol. I, No. 1</span>
          </div>
        </div>

        <div className="container-editorial py-8">

          {/* ── HERO + SECONDARY ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">

            {/* Hero: image right, text dominant left */}
            <article className="lg:col-span-2 group">
              <Link href={`/${hero.pillar}/${hero.slug}`}>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 items-start">
                  {/* Text block — dominant */}
                  <div className="sm:col-span-3 space-y-3">
                    <PillarBadge pillar={hero.pillar} />
                    <h2
                      className="text-3xl sm:text-4xl font-serif font-bold leading-tight group-hover:opacity-80 transition-opacity"
                      style={{ color: "var(--navy)" }}
                    >
                      {hero.title}
                    </h2>
                    <p
                      className="text-base font-serif italic"
                      style={{ color: "var(--red)" }}
                    >
                      {hero.satiricalHeadline}
                    </p>
                    <p className="text-sm font-sans leading-relaxed" style={{ color: "var(--ink-m)" }}>
                      {hero.excerpt}
                    </p>
                    <Meta date={hero.publishedAt} readTime={hero.readTime} />
                  </div>
                  {/* Image right */}
                  <div
                    className="sm:col-span-2 rounded-sm"
                    style={{
                      background: "linear-gradient(135deg, var(--navy) 0%, #1a2a3a 100%)",
                      height: "220px",
                    }}
                  />
                </div>
              </Link>
            </article>

            {/* Secondary stories */}
            <aside className="space-y-0">
              <div className="rule-thick mb-4" />
              <h3 className="eyebrow mb-4">Top Stories</h3>
              <div className="space-y-0">
                {secondary.map((article, i) => (
                  <article key={article.slug} className="group">
                    <Link href={`/${article.pillar}/${article.slug}`}>
                      <div className="py-4 border-b" style={{ borderColor: "var(--border)" }}>
                        <PillarBadge pillar={article.pillar} />
                        <h3
                          className="text-base font-serif font-bold mt-1.5 leading-snug group-hover:opacity-70 transition-opacity"
                          style={{ color: "var(--navy)" }}
                        >
                          {article.title}
                        </h3>
                        <p className="text-xs font-serif italic mt-1" style={{ color: "var(--red)" }}>
                          {article.satiricalHeadline}
                        </p>
                        <div className="mt-2">
                          <Meta date={article.publishedAt} readTime={article.readTime} />
                        </div>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </aside>
          </div>

          {/* ── MARKET SNAPSHOT STRIP ───────────────────────── */}
          <section className="mb-10">
            <div className="rule-thick mb-4" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="eyebrow">Market Snapshot</h2>
              <span className="eyebrow-muted">As of {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} UTC</span>
            </div>
            <div
  className="grid grid-cols-3 sm:grid-cols-6 divide-x [--tw-divide-opacity:1] divide-[var(--border)]"
  style={{ border: "1px solid var(--border)" }}
>
            
              {TICKER_DATA.slice(0, 6).map((item) => (
                <div
                  key={item.symbol}
                  className="p-3 text-center"
                  style={{ background: "var(--surface)" }}
                >
                  <div className="data-label mb-1">{item.symbol}</div>
                  <div className="data-value text-sm" style={{ color: "var(--navy)" }}>
                    {item.value}
                  </div>
                  <div
                    className="text-xs mt-0.5"
                    style={{
                      color: item.up ? "#16a34a" : "#dc2626",
                      fontFamily: "var(--font-jetbrains)",
                    }}
                  >
                    {item.change}
                  </div>
                  {/* Sparkline placeholder */}
                  <div className="mt-2 h-8 flex items-end justify-center gap-0.5">
                    {[40, 55, 35, 65, 50, 70, item.up ? 80 : 45].map((h, i) => (
                      <div
                        key={i}
                        style={{
                          width: "3px",
                          height: `${h}%`,
                          background: item.up ? "#16a34a" : "#dc2626",
                          opacity: 0.6 + (i / 7) * 0.4,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── SECTION ROWS ─────────────────────────────────── */}
          <div className="space-y-12">
            {PILLARS.map((pillar) => {
              const articles = MOCK_ARTICLES.filter((a) => a.pillar === pillar.slug).slice(0, 4);
              if (articles.length === 0) return null;

              return (
                <section key={pillar.slug}>
                  <div className="rule-thick mb-4" />
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="eyebrow">{pillar.name}</h2>
                      <p className="text-xs font-sans mt-0.5 hidden sm:block" style={{ color: "var(--ink-m)" }}>
                        {pillar.description}
                      </p>
                    </div>
                    <Link
                      href={`/${pillar.slug}`}
                      className="flex items-center gap-1 text-xs font-sans font-semibold transition-colors hover:opacity-70"
                      style={{ color: "var(--red)", fontFamily: "var(--font-jetbrains)" }}
                    >
                      More <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {/* Horizontal scroll on mobile, 4-col on desktop */}
                  <div className="flex gap-6 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
                    {articles.map((article, i) => (
                      <article
                        key={article.slug}
                        className="group flex-shrink-0 w-64 lg:w-auto"
                      >
                        <Link href={`/${article.pillar}/${article.slug}`}>
                          {/* Image placeholder */}
                          {i === 0 && (
                            <div
                              className="mb-3 rounded-sm"
                              style={{
                                height: "140px",
                                background: "linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%)",
                              }}
                            />
                          )}
                          <PillarBadge pillar={article.pillar} />
                          <h3
                            className="text-sm font-serif font-bold mt-1.5 leading-snug group-hover:opacity-70 transition-opacity"
                            style={{ color: "var(--navy)" }}
                          >
                            {article.title}
                          </h3>
                          <p className="text-xs font-serif italic mt-1" style={{ color: "var(--red)" }}>
                            {article.satiricalHeadline}
                          </p>
                          <div className="mt-2">
                            <Meta date={article.publishedAt} readTime={article.readTime} />
                          </div>
                        </Link>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* ── ECONOMY SPOTLIGHT ────────────────────────────── */}
          <section className="mt-12">
            <div className="rule-thick mb-4" />
            <h2 className="eyebrow mb-5">Economy Spotlight</h2>
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-0"
              style={{ border: "1px solid var(--border)" }}
            >
              {/* Left: country info */}
              <div className="p-8" style={{ background: "var(--navy)", color: "var(--cream)" }}>
                <div className="text-5xl mb-3">{spotlightEconomy.flag}</div>
                <h3 className="text-2xl font-serif font-bold mb-2" style={{ color: "var(--cream)" }}>
                  {spotlightEconomy.name}
                </h3>
                <p className="text-sm font-sans mb-6" style={{ color: "rgba(245,240,232,0.6)" }}>
                  This week's economy in focus — fiscal crossroads, rate uncertainty, and a labour market refusing to cooperate.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "GDP Growth", value: "2.8%" },
                    { label: "Inflation", value: "3.2%" },
                    { label: "Unemployment", value: "3.9%" },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className="data-label text-2xs" style={{ color: "rgba(245,240,232,0.45)" }}>
                        {stat.label}
                      </div>
                      <div className="data-value text-xl mt-0.5" style={{ color: "var(--cream)" }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href={`/economies/${spotlightEconomy.slug}`}
                  className="inline-flex items-center gap-1 mt-6 text-sm font-sans transition-colors"
                  style={{ color: "var(--gold)" }}
                >
                  Full economy briefing <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Right: recent articles tagged to this economy */}
              <div className="p-8" style={{ background: "var(--surface)" }}>
                <h4 className="eyebrow mb-4">Recent Coverage</h4>
                <div className="space-y-4">
                  {MOCK_ARTICLES.slice(0, 3).map((article) => (
                    <article key={article.slug} className="group border-b pb-4" style={{ borderColor: "var(--border)" }}>
                      <Link href={`/${article.pillar}/${article.slug}`}>
                        <PillarBadge pillar={article.pillar} />
                        <p
                          className="text-sm font-serif font-bold mt-1 leading-snug group-hover:opacity-70 transition-opacity"
                          style={{ color: "var(--navy)" }}
                        >
                          {article.title}
                        </p>
                        <Meta date={article.publishedAt} readTime={article.readTime} />
                      </Link>
                    </article>
                  ))}
                </div>
                <Link
                  href="/economies"
                  className="inline-flex items-center gap-1 mt-4 text-xs font-sans font-semibold transition-colors hover:opacity-70"
                  style={{ color: "var(--red)", fontFamily: "var(--font-jetbrains)" }}
                >
                  All 30 economies <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </section>

          {/* ── NEWSLETTER CTA ───────────────────────────────── */}
          <div
            className="mt-16 p-10 sm:p-14 text-center"
            style={{ background: "var(--navy)" }}
          >
            <h2
              className="text-3xl sm:text-4xl font-serif font-bold mb-3"
              style={{ color: "var(--cream)" }}
            >
              Five stories. Every morning. Under 5 minutes.
            </h2>
            <p className="text-sm font-sans mb-8 max-w-lg mx-auto" style={{ color: "rgba(245,240,232,0.55)" }}>
              Join executives and investors who start their day with The Boardroom Brief.
            </p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 text-sm font-sans px-4 py-3 outline-none"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "var(--cream)",
                  borderRadius: "2px",
                }}
              />
              <button type="submit" className="btn-red whitespace-nowrap">
                Get the brief
              </button>
            </form>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
