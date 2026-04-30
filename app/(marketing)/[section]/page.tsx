import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { PILLARS, MOCK_ARTICLES, ECONOMIES, getPillar, formatDateShort } from "@/app/lib/mock-data";
import { getArticlesByPillar, type SanityArticle } from "@/app/lib/queries";

export const revalidate = 60;

interface Props {
  params: Promise<{ section: string }>;
}

export function generateStaticParams() {
  return PILLARS.map((p) => ({ section: p.slug }));
}

function PillarBadge({ pillar }: { pillar: string }) {
  const p = PILLARS.find((x) => x.slug === pillar);
  if (!p) return null;
  return <span className={`pillar-badge text-2xs ${p.color}`}>{p.name}</span>;
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

function MarketsFloorWidget() {
  const indices = [
    { name: "S&P 500",  value: "5,218.19", change: "+0.87%", up: true },
    { name: "DAX",      value: "18,492.35", change: "+0.31%", up: true },
    { name: "FTSE 100", value: "8,112.60",  change: "-0.14%", up: false },
    { name: "Nikkei",   value: "39,872.11", change: "+1.22%", up: true },
    { name: "Hang Seng",value: "17,284.54", change: "-0.88%", up: false },
    { name: "Bovespa",  value: "128,543",   change: "+0.42%", up: true },
  ];
  return (
    <div>
      <p className="eyebrow mb-3">Live Indices</p>
      <div style={{ border: "1px solid var(--border)" }}>
        {indices.map((idx) => (
          <div key={idx.name} className="flex justify-between items-center px-3 py-2.5 border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <span className="data-label text-2xs">{idx.name}</span>
            <div className="text-right">
              <div className="data-value text-xs" style={{ color: "var(--navy)" }}>{idx.value}</div>
              <div className="text-2xs" style={{ color: idx.up ? "#16a34a" : "#dc2626", fontFamily: "var(--font-jetbrains)" }}>{idx.change}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GlobalOfficeWidget() {
  const regions = [
    { name: "Americas", economies: ["US", "BR", "MX", "CA"] },
    { name: "Europe",   economies: ["GB", "DE", "FR", "IT"] },
    { name: "Asia-Pac", economies: ["CN", "JP", "IN", "KR"] },
    { name: "ME & AF",  economies: ["SA", "AE", "ZA", "NG"] },
  ];
  return (
    <div>
      <p className="eyebrow mb-3">Coverage by Region</p>
      <div className="space-y-3">
        {regions.map((region) => (
          <div key={region.name}>
            <p className="eyebrow-muted text-2xs mb-1.5">{region.name}</p>
            <div className="flex gap-1.5 flex-wrap">
              {region.economies.map((code) => {
                const eco = ECONOMIES.find((e) => e.code === code);
                return eco ? (
                  <Link key={code} href={`/economies/${eco.slug}`}
                    className="hover-card px-2 py-1 text-2xs font-mono inline-block"
                    style={{ color: "var(--ink-m)", borderRadius: "2px" }}
                  >
                    {eco.flag} {code}
                  </Link>
                ) : null;
              })}
            </div>
          </div>
        ))}
      </div>
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
  };
}

export default async function SectionPage({ params }: Props) {
  const { section: sectionSlug } = await params;
  const pillar = getPillar(sectionSlug);
  if (!pillar) notFound();

  let articles = MOCK_ARTICLES.filter((a) => a.pillar === sectionSlug);
  try {
    const sanityArticles = await getArticlesByPillar(sectionSlug, 20);
    if (sanityArticles.length > 0) {
      articles = sanityArticles.map(normaliseSanity) as unknown as typeof MOCK_ARTICLES;
    }
  } catch {
    // Sanity unavailable — use mock data
  }

  const seen = new Set<string>();
  const unique = articles.filter((a) => {
    if (seen.has(a.slug)) return false;
    seen.add(a.slug);
    return true;
  });
  const displayArticles = unique.length >= 2
    ? unique
    : [...unique, ...MOCK_ARTICLES.filter((a) => a.pillar !== sectionSlug && !seen.has(a.slug)).slice(0, 6 - unique.length)];

  const featured = displayArticles[0];
  const grid = displayArticles.slice(1);

  return (
    <div style={{ background: "var(--cream)" }}>

      {/* Section header */}
      <div style={{ background: "var(--navy)", borderBottom: "2px solid var(--red)" }}>
        <div className="container-editorial py-4 flex items-center gap-3">
          <span className={`pillar-badge text-2xs ${pillar.color}`} style={{ borderColor: "rgba(245,240,232,0.3)", color: "rgba(245,240,232,0.65)" }}>
            {pillar.name}
          </span>
          <h1 className="text-lg font-serif font-bold" style={{ color: "var(--cream)" }}>
            {pillar.description}
          </h1>
        </div>
      </div>

      <div className="container-editorial py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Main content */}
          <div className="lg:col-span-2">

            {/* Featured article */}
            {featured && (
              <article className="group mb-8 pb-8 border-b" style={{ borderColor: "var(--border)" }}>
                <Link href={`/${featured.pillar}/${featured.slug}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 items-start">
                    <div className="sm:col-span-3 space-y-2">
                      <PillarBadge pillar={featured.pillar} />
                      <h2 className="text-2xl sm:text-3xl font-serif font-bold leading-tight group-hover:opacity-70 transition-opacity" style={{ color: "var(--navy)" }}>
                        {featured.title}
                      </h2>
                      <p className="text-base font-serif italic" style={{ color: "var(--red)" }}>{featured.satiricalHeadline}</p>
                      <p className="text-sm font-sans leading-relaxed" style={{ color: "var(--ink-m)" }}>{featured.excerpt}</p>
                      <Meta date={featured.publishedAt} readTime={featured.readTime} />
                    </div>
                    <div className="sm:col-span-2 rounded-sm"
                      style={{ background: "linear-gradient(135deg, var(--navy) 0%, #1a2a3a 100%)", height: "200px" }} />
                  </div>
                </Link>
              </article>
            )}

            {/* Article grid — 2 col */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
              {grid.map((article) => (
                <article key={article.slug} className="group border-b pb-6" style={{ borderColor: "var(--border)" }}>
                  <Link href={`/${article.pillar}/${article.slug}`}>
                    <PillarBadge pillar={article.pillar} />
                    <h3 className="text-base font-serif font-bold mt-1.5 leading-snug group-hover:opacity-70 transition-opacity" style={{ color: "var(--navy)" }}>
                      {article.title}
                    </h3>
                    <p className="text-sm font-serif italic mt-1" style={{ color: "var(--red)" }}>{article.satiricalHeadline}</p>
                    <p className="text-xs font-sans mt-2 line-clamp-2 leading-relaxed" style={{ color: "var(--ink-m)" }}>{article.excerpt}</p>
                    <div className="mt-3"><Meta date={article.publishedAt} readTime={article.readTime} /></div>
                  </Link>
                </article>
              ))}
            </div>

            <div className="text-center mt-10">
              <button className="btn-navy">Load more articles</button>
            </div>
          </div>

          {/* Sidebar */}
          <aside>
            <div className="lg:sticky lg:top-4 space-y-8">
              <div>
                <div className="rule-thick mb-4" />
                {sectionSlug === "markets-floor" && <MarketsFloorWidget />}
                {sectionSlug === "global-office" && <GlobalOfficeWidget />}
                {!["markets-floor", "global-office"].includes(sectionSlug) && (
                  <div className="p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <p className="eyebrow mb-2">About {pillar.name}</p>
                    <p className="text-sm font-sans leading-relaxed" style={{ color: "var(--ink-m)" }}>{pillar.description}</p>
                  </div>
                )}
              </div>

              <div>
                <div className="rule-thick mb-4" />
                <p className="eyebrow mb-4">Other Sections</p>
                <div className="space-y-2">
                  {PILLARS.filter((p) => p.slug !== sectionSlug).map((p) => (
                    <Link key={p.slug} href={`/${p.slug}`}
                      className="flex items-center justify-between py-2 border-b group transition-colors hover:opacity-70"
                      style={{ borderColor: "var(--border)" }}>
                      <span className={`pillar-badge text-2xs ${p.color}`}>{p.name}</span>
                      <ArrowRight className="w-3 h-3" style={{ color: "var(--ink-m)" }} />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="p-6" style={{ background: "var(--navy)" }}>
                <p className="eyebrow-gold mb-2" style={{ color: "var(--gold)" }}>Daily Brief</p>
                <h3 className="font-serif font-bold mb-3" style={{ color: "var(--cream)" }}>Get {pillar.name} in your inbox</h3>
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
