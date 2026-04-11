import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";
import MarketTicker from "@/app/components/MarketTicker";
import EconomySelector from "@/app/components/EconomySelector";
import { MOCK_ARTICLES, PILLARS, TICKER_DATA, CONTINENTS, formatDateShort } from "@/app/lib/mock-data";
import { getLatestArticles, type SanityArticle } from "@/app/lib/queries";
import { Clock, Mic, ArrowRight } from "lucide-react";

export const revalidate = 60;

function PillarBadge({ pillar }: { pillar: string }) {
  const p = PILLARS.find((x) => x.slug === pillar);
  if (!p) return null;
  return <span className={`pillar-badge text-2xs ${p.color}`}>{p.name}</span>;
}

function Meta({ date, readTime, isPodcast }: { date: string; readTime: number; isPodcast?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>
      <span>{formatDateShort(date)}</span>
      <span className="flex items-center gap-1">
        {isPodcast ? <Mic className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
        {isPodcast ? `${readTime} min listen` : `${readTime} min`}
      </span>
    </div>
  );
}

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
    featured: false,
  };
}

interface ArticleLead {
  slug: string;
  title: string;
  satiricalHeadline: string;
  excerpt: string;
  publishedAt: string;
  readTime: number;
  pillar: string;
  author?: string;
  coverImage?: string | null;
  featured?: boolean;
}

// Top story per pillar — curated from mock data, overridden by Sanity when live
const CURATED: Record<string, string> = {
  "markets-floor":  "fed-holds-rates-signals-caution-2026",
  "c-suite-circus": "ceo-turnover-record-q1-2026",
  "global-office":  "eu-ai-act-enforcement-begins",
  "water-cooler":   "open-plan-office-productivity-myth",
  "off-the-record": "ep12-the-performance-review-industrial-complex",
};

export default async function HomePage() {
  // Build a map of pillar → top article, using Sanity if available else mock
  let sanityByPillar: Record<string, ArticleLead> = {};
  try {
    const sanityArticles = await getLatestArticles(20);
    for (const a of sanityArticles) {
      const pillarSlug = a.pillar?.slug?.current;
      if (pillarSlug && !sanityByPillar[pillarSlug]) {
        sanityByPillar[pillarSlug] = normaliseSanity(a);
      }
    }
  } catch { /* fall through */ }

  // 1 lead story per pillar, excluding Macro Mondays
  const pillarLeads: { pillar: (typeof PILLARS)[0]; article: ArticleLead }[] = PILLARS
    .filter((p) => p.slug !== "macro-mondays")
    .flatMap((pillar) => {
      const article: ArticleLead | undefined =
        sanityByPillar[pillar.slug] ??
        MOCK_ARTICLES.find((a) => a.slug === CURATED[pillar.slug]) ??
        MOCK_ARTICLES.find((a) => a.pillar === pillar.slug);
      return article ? [{ pillar, article }] : [];
    });

  const hero = pillarLeads[0];
  const grid = pillarLeads.slice(1);

  return (
    <>
      <MarketTicker />
      <Navigation />

      <main style={{ background: "var(--cream)" }}>
        <div className="container-editorial py-8">

          {/* ── HERO ─────────────────────────────────────────── */}
          {hero && (
            <section className="mb-10">
              <div className="rule-thick mb-6" />
              <article className="group">
                <Link href={`/${hero.article.pillar}/${hero.article.slug}`}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                      <PillarBadge pillar={hero.article.pillar} />
                      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold leading-tight group-hover:opacity-80 transition-opacity" style={{ color: "var(--navy)" }}>
                        {hero.article.title}
                      </h2>
                      <p className="text-lg font-serif italic" style={{ color: "var(--red)" }}>
                        {hero.article.satiricalHeadline}
                      </p>
                      <p className="text-sm font-sans leading-relaxed" style={{ color: "var(--ink-m)" }}>
                        {hero.article.excerpt}
                      </p>
                      <Meta date={hero.article.publishedAt} readTime={hero.article.readTime} />
                    </div>
                    <div className="rounded-sm" style={{ background: "linear-gradient(135deg, var(--navy) 0%, #1a2a3a 100%)", height: "320px" }} />
                  </div>
                </Link>
              </article>
            </section>
          )}

          {/* ── TODAY'S EDITION — 1 per pillar ───────────────── */}
          <section className="mb-12">
            <div className="rule-thick mb-2" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="eyebrow">Today&apos;s Edition</h2>
              <span className="eyebrow-muted text-2xs" style={{ fontFamily: "var(--font-jetbrains)" }}>
                One story per pillar
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {grid.map(({ pillar, article }) => (
                <article key={pillar.slug} className="group border-b pb-5" style={{ borderColor: "var(--border)" }}>
                  <Link href={`/${article.pillar}/${article.slug}`}>
                    {/* Colour accent strip */}
                    <div className="h-0.5 mb-4" style={{ background: "var(--border)" }} />
                    <PillarBadge pillar={article.pillar} />
                    {pillar.isPodcast && (
                      <span className="ml-2 inline-flex items-center gap-1 text-2xs font-mono uppercase" style={{ color: "var(--ink-m)" }}>
                        <Mic className="w-2.5 h-2.5" /> Podcast
                      </span>
                    )}
                    <h3 className="text-base font-serif font-bold mt-2 leading-snug group-hover:opacity-70 transition-opacity" style={{ color: "var(--navy)" }}>
                      {article.title}
                    </h3>
                    <p className="text-xs font-serif italic mt-1" style={{ color: "var(--red)" }}>
                      {article.satiricalHeadline}
                    </p>
                    <p className="text-xs font-sans mt-2 leading-relaxed line-clamp-2" style={{ color: "var(--ink-m)" }}>
                      {article.excerpt}
                    </p>
                    <div className="mt-3">
                      <Meta date={article.publishedAt} readTime={article.readTime} isPodcast={pillar.isPodcast} />
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </section>

          {/* ── MARKET SNAPSHOT STRIP ────────────────────────── */}
          <section className="mb-12">
            <div className="rule-thick mb-4" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="eyebrow">Market Snapshot</h2>
              <span className="eyebrow-muted" suppressHydrationWarning>
                As of {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} UTC
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 divide-x" style={{ border: "1px solid var(--border)", borderColor: "var(--border)" }}>
              {TICKER_DATA.slice(0, 6).map((item) => (
                <div key={item.symbol} className="p-3 text-center" style={{ background: "var(--surface)" }}>
                  <div className="data-label mb-1">{item.symbol}</div>
                  <div className="data-value text-sm" style={{ color: "var(--navy)" }}>{item.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: item.up ? "#16a34a" : "#dc2626", fontFamily: "var(--font-jetbrains)" }}>
                    {item.change}
                  </div>
                  <div className="mt-2 h-8 flex items-end justify-center gap-0.5">
                    {[40, 55, 35, 65, 50, 70, item.up ? 80 : 45].map((h, i) => (
                      <div key={i} style={{ width: "3px", height: `${h}%`, background: item.up ? "#16a34a" : "#dc2626", opacity: 0.6 + (i / 7) * 0.4 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── ECONOMY SELECTOR ─────────────────────────────── */}
          <section className="mb-12">
            <div className="rule-thick mb-4" />
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="eyebrow">5 Continents</h2>
                <p className="text-xs font-sans mt-0.5" style={{ color: "var(--ink-m)" }}>
                  Continental briefings — key indicators, leading economies, and latest coverage
                </p>
              </div>
              <Link href="/economies" className="flex items-center gap-1 text-xs font-sans font-semibold transition-colors hover:opacity-70" style={{ color: "var(--red)", fontFamily: "var(--font-jetbrains)" }}>
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <EconomySelector continents={CONTINENTS} />
          </section>

          {/* ── NEWSLETTER CTA ───────────────────────────────── */}
          <div className="mt-8 p-10 sm:p-14 text-center" style={{ background: "var(--navy)" }}>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-3" style={{ color: "var(--cream)" }}>
              Five stories. Every morning. Under 5 minutes.
            </h2>
            <p className="text-sm font-sans mb-8 max-w-lg mx-auto" style={{ color: "rgba(245,240,232,0.55)" }}>
              Join executives and investors who start their day with The Alignment Times.
            </p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input type="email" placeholder="your@email.com" className="flex-1 text-sm font-sans px-4 py-3 outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.2)", color: "var(--cream)", borderRadius: "2px" }} />
              <button type="submit" className="btn-red whitespace-nowrap">Get the brief</button>
            </form>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
