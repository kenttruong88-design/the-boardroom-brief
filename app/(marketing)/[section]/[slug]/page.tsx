import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, ArrowLeft, Share2, Bookmark, Link2, MessageSquare } from "lucide-react";
import { MOCK_ARTICLES, PILLARS, getArticleBySlug as getMockArticle, formatDate, formatDateShort } from "@/app/lib/mock-data";
import { getArticleBySlug as getSanityArticle } from "@/app/lib/queries";
import ArticleReadTracker from "@/app/components/ArticleReadTracker";

export const revalidate = 60;

interface Props {
  params: Promise<{ section: string; slug: string }>;
}

async function resolveArticle(slug: string) {
  try {
    const sanity = await getSanityArticle(slug);
    if (sanity) {
      return {
        title: sanity.title,
        slug: sanity.slug.current,
        satiricalHeadline: sanity.satiricalHeadline ?? "",
        excerpt: sanity.excerpt ?? "",
        publishedAt: sanity.publishedAt,
        readTime: sanity.readTime ?? 5,
        pillar: sanity.pillar?.slug?.current ?? "markets-floor",
        author: sanity.author?.name ?? "Staff Writer",
        coverImage: sanity.coverImage?.asset?.url ?? null,
        _fromSanity: true,
      };
    }
  } catch { /* fall through */ }
  return getMockArticle(slug) ?? null;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealignmenttimes.com";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section, slug } = await params;
  const article = await resolveArticle(slug);
  if (!article) return {};

  const canonicalUrl = `${SITE_URL}/${section}/${slug}`;
  const ogImage = (article as { coverImage?: string | null }).coverImage
    ?? `${SITE_URL}/api/og?title=${encodeURIComponent(article.title)}`;

  return {
    title: `${article.title} | The Alignment Times`,
    description: article.excerpt,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: article.title,
      description: article.satiricalHeadline,
      type: "article",
      publishedTime: article.publishedAt,
      authors: [(article as { author?: string }).author ?? "The Alignment Times"],
      url: canonicalUrl,
      images: [{ url: ogImage, width: 1200, height: 630, alt: article.title }],
      siteName: "The Alignment Times",
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.satiricalHeadline,
      images: [ogImage],
    },
  };
}

export function generateStaticParams() {
  return MOCK_ARTICLES.map((a) => ({ section: a.pillar, slug: a.slug }));
}

export default async function ArticlePage({ params }: Props) {
  const { section: sectionSlug, slug } = await params;
  const article = await resolveArticle(slug);
  if (!article || article.pillar !== sectionSlug) notFound();

  const pillar = PILLARS.find((p) => p.slug === sectionSlug);
  const related = MOCK_ARTICLES.filter((a) => a.pillar === sectionSlug && a.slug !== slug).slice(0, 3);

  const canonicalUrl = `${SITE_URL}/${sectionSlug}/${slug}`;
  const articleAuthor = (article as { author?: string }).author ?? "The Alignment Times";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        "headline": article.title,
        "description": article.excerpt,
        "datePublished": article.publishedAt,
        "dateModified": article.publishedAt,
        "author": { "@type": "Person", "name": articleAuthor },
        "publisher": {
          "@type": "Organization",
          "name": "The Alignment Times",
          "url": SITE_URL,
          "logo": { "@type": "ImageObject", "url": `${SITE_URL}/logo.png` },
        },
        "url": canonicalUrl,
        "mainEntityOfPage": canonicalUrl,
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
          { "@type": "ListItem", "position": 2, "name": pillar?.name ?? sectionSlug, "item": `${SITE_URL}/${sectionSlug}` },
          { "@type": "ListItem", "position": 3, "name": article.title, "item": canonicalUrl },
        ],
      },
    ],
  };

  return (
    <div style={{ background: "var(--cream)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ArticleReadTracker slug={slug} section={sectionSlug} articleId={slug} />
      <div className="container-editorial py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-8 text-sm font-sans">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:opacity-70" style={{ color: "var(--ink-m)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </Link>
          <span style={{ color: "var(--border)" }}>/</span>
          {pillar && (
            <Link href={`/${pillar.slug}`} className="transition-colors hover:opacity-70" style={{ color: "var(--ink-m)" }}>
              {pillar.name}
            </Link>
          )}
        </nav>

        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Floating social share — desktop left edge */}
          <div className="hidden xl:flex flex-col items-center gap-3 absolute -left-14 top-0">
            {[
              { icon: <Link2 className="w-4 h-4" />,         title: "LinkedIn" },
              { icon: <MessageSquare className="w-4 h-4" />, title: "X / Twitter" },
              { icon: <Share2 className="w-4 h-4" />,       title: "Copy link" },
              { icon: <Bookmark className="w-4 h-4" />,     title: "Bookmark" },
            ].map((btn) => (
              <button key={btn.title}
                className="w-9 h-9 flex items-center justify-center border transition-colors hover:border-red-accent"
                style={{ border: "1px solid var(--border)", color: "var(--ink-m)" }}
                title={btn.title}
              >
                {btn.icon}
              </button>
            ))}
          </div>

          {/* Main article */}
          <article className="lg:col-span-2">
            <header className="mb-8">
              {pillar && (
                <span className={`pillar-badge text-2xs mb-4 inline-block ${pillar.color}`}>{pillar.name}</span>
              )}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold leading-tight mb-4" style={{ color: "var(--navy)" }}>
                {article.title}
              </h1>
              <p className="text-lg sm:text-xl font-serif italic mb-6" style={{ color: "var(--red)" }}>
                {article.satiricalHeadline}
              </p>
              <div className="rule mb-4" />
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 text-sm font-sans" style={{ color: "var(--ink-m)" }}>
                  <span className="font-semibold" style={{ color: "var(--navy)" }}>{article.author}</span>
                  <span>{formatDate(article.publishedAt)}</span>
                  <span className="flex items-center gap-1" style={{ fontFamily: "var(--font-jetbrains)" }}>
                    <Clock className="w-3.5 h-3.5" /> {article.readTime} min read
                  </span>
                </div>
                <div className="flex xl:hidden items-center gap-2">
                  <button className="p-2 border" style={{ border: "1px solid var(--border)", color: "var(--ink-m)", borderRadius: "2px" }}><Share2 className="w-4 h-4" /></button>
                  <button className="p-2 border" style={{ border: "1px solid var(--border)", color: "var(--ink-m)", borderRadius: "2px" }}><Bookmark className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="rule mt-4" />
            </header>

            {/* Hero image placeholder */}
            <div className="mb-8 rounded-sm" style={{ background: "linear-gradient(135deg, var(--navy) 0%, #1a2a3a 100%)", height: "340px" }} />

            {/* Article body */}
            <div className="font-sans text-base leading-relaxed space-y-5" style={{ color: "var(--ink)" }}>
              <p className="drop-cap">
                {article.excerpt} Markets are digesting a complex mix of signals as central banks navigate the final stretch of the tightening cycle. The interplay between stubborn core inflation, resilient labour markets, and slowing growth is forcing policymakers into increasingly difficult tradeoffs — the kind that require press conferences and carefully calibrated ambiguity.
              </p>
              <p>
                The latest readings point to a bifurcated economy. Services inflation remains elevated, driven by wage growth and sticky shelter costs, while goods deflation has largely run its course. This creates a challenging environment for central bank communication — which, if you have followed central bank communication for any length of time, was already challenging enough.
              </p>
              <blockquote className="pull-quote">
                "The path back to 2% remains bumpy. We are committed to getting there. Also, please stop asking us when."
              </blockquote>
              <h2 className="text-xl font-serif font-bold mt-8" style={{ color: "var(--navy)" }}>What the data shows</h2>
              <p>
                For executives navigating capital allocation decisions, the message is clear: cost of capital is normalising at higher levels than the post-GFC era. Balance sheet discipline and cash flow visibility are being rewarded by investors in ways not seen since the early 2000s.
              </p>
              <p>
                Companies that locked in long-duration debt at pandemic-era rates have a meaningful competitive advantage. That window is now closed. The remaining question is not whether rates come down, but how slowly.
              </p>
              <h2 className="text-xl font-serif font-bold mt-8" style={{ color: "var(--navy)" }}>The boardroom implication</h2>
              <p>
                Three things to watch: the next core PCE print, any revision to forward guidance language, and whether the Fed's dot plot shifts at the June meeting. If you are building a capital plan that assumes rates return to 2% territory before 2027, you may wish to revisit those assumptions with a beverage of your choosing.
              </p>

              {/* Paywall gate */}
              <div className="border-t pt-10 mt-10" style={{ borderColor: "var(--border)" }}>
                <div className="p-10 text-center" style={{ background: "var(--navy)" }}>
                  <p className="eyebrow-gold mb-3" style={{ color: "var(--gold)" }}>Subscriber Only</p>
                  <h3 className="text-xl font-serif font-bold mb-3" style={{ color: "var(--cream)" }}>
                    Continue reading with a free account
                  </h3>
                  <p className="text-sm font-sans mb-6" style={{ color: "rgba(245,240,232,0.6)" }}>
                    Unlimited access to The Alignment Times — free for a limited time.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Link href="/subscribe" className="btn-red">Subscribe free</Link>
                    <Link href="/login" className="btn-outline" style={{ border: "1px solid rgba(255,255,255,0.25)", color: "var(--cream)" }}>Sign in</Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Author card */}
            <div className="mt-10 p-6 border flex items-center gap-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="w-14 h-14 rounded-full flex-shrink-0" style={{ background: "var(--navy)" }} />
              <div>
                <p className="font-serif font-bold" style={{ color: "var(--navy)" }}>{article.author}</p>
                <p className="text-sm font-sans mt-0.5" style={{ color: "var(--ink-m)" }}>
                  Staff writer covering financial markets and corporate strategy. Has strong opinions about spreadsheets.
                </p>
              </div>
            </div>

            {/* More from section */}
            {related.length > 0 && (
              <div className="mt-12">
                <div className="rule-thick mb-5" />
                <h3 className="eyebrow mb-5">More from {pillar?.name}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {related.map((a) => (
                    <article key={a.slug} className="group">
                      <Link href={`/${a.pillar}/${a.slug}`}>
                        <span className={`pillar-badge text-2xs ${pillar?.color}`}>{pillar?.name}</span>
                        <h4 className="text-sm font-serif font-bold mt-1.5 leading-snug group-hover:opacity-70 transition-opacity" style={{ color: "var(--navy)" }}>{a.title}</h4>
                        <p className="text-xs font-serif italic mt-1" style={{ color: "var(--red)" }}>{a.satiricalHeadline}</p>
                        <p className="text-xs mt-2" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>{formatDateShort(a.publishedAt)}</p>
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* Comments placeholder */}
            <div className="mt-12 p-6 border" style={{ borderColor: "var(--border)" }}>
              <p className="eyebrow-muted">Comments</p>
              <p className="text-sm font-sans mt-2" style={{ color: "var(--ink-m)" }}>Comments are available to subscribers. Sign in to join the conversation.</p>
              <Link href="/login" className="btn-navy mt-4 inline-block text-sm">Sign in to comment</Link>
            </div>
            {/* End sentinel for 80% scroll tracking */}
            <div id="article-end-sentinel" aria-hidden="true" />
          </article>

          {/* Sidebar */}
          <aside>
            <div className="lg:sticky lg:top-4 space-y-8">

              {related.length > 0 && (
                <div>
                  <div className="rule-thick mb-4" />
                  <h3 className="eyebrow mb-4">Related</h3>
                  <div className="space-y-4">
                    {related.map((a) => (
                      <article key={a.slug} className="group border-b pb-4" style={{ borderColor: "var(--border)" }}>
                        <Link href={`/${a.pillar}/${a.slug}`}>
                          <p className="text-sm font-serif font-bold leading-snug group-hover:opacity-70 transition-opacity" style={{ color: "var(--navy)" }}>{a.title}</p>
                          <p className="text-2xs mt-1" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>{formatDateShort(a.publishedAt)}</p>
                        </Link>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {/* Market snapshot widget */}
              <div>
                <div className="rule-thick mb-4" />
                <h3 className="eyebrow mb-4">Market Snapshot</h3>
                <div style={{ border: "1px solid var(--border)" }}>
                  {[
                    { symbol: "S&P 500", value: "5,218.19", change: "+0.87%", up: true },
                    { symbol: "10Y UST", value: "4.38%",    change: "+3bps",   up: false },
                    { symbol: "EUR/USD", value: "1.0812",   change: "-0.21%",  up: false },
                    { symbol: "Gold",    value: "$2,318",   change: "+0.54%",  up: true },
                  ].map((item) => (
                    <div key={item.symbol} className="flex justify-between items-center px-3 py-2 border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <span className="data-label">{item.symbol}</span>
                      <div className="text-right">
                        <div className="data-value text-xs" style={{ color: "var(--navy)" }}>{item.value}</div>
                        <div className="text-2xs" style={{ color: item.up ? "#16a34a" : "#dc2626", fontFamily: "var(--font-jetbrains)" }}>{item.change}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Newsletter */}
              <div className="p-6" style={{ background: "var(--navy)" }}>
                <p className="eyebrow-gold mb-2" style={{ color: "var(--gold)" }}>Daily Brief</p>
                <h3 className="font-serif font-bold mb-2" style={{ color: "var(--cream)" }}>Get this in your inbox</h3>
                <p className="text-xs font-sans mb-4" style={{ color: "rgba(245,240,232,0.55)" }}>Five stories every morning. Free, always.</p>
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
