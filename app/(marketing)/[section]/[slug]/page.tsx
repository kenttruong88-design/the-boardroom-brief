import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Clock, ArrowLeft, Bookmark } from "lucide-react";
import { MOCK_ARTICLES, PILLARS, getArticleBySlug as getMockArticle, formatDate, formatDateShort } from "@/app/lib/mock-data";
import { getArticleBySlug as getSanityArticle } from "@/app/lib/queries";
import ArticleReadTracker from "@/app/components/ArticleReadTracker";
import { getCommentCounts } from "@/app/lib/comment-counts";
import SubscribeForm from "@/app/components/newsletter/SubscribeForm";
import ShareButtons from "@/app/components/article/ShareButtons";
import PaywallGate from "@/app/components/article/PaywallGate";
import AdUnit from "@/app/components/AdUnit";
import CommentSectionLoader from "@/app/components/article/CommentSectionLoader";

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
        heroImageUrl:          sanity.heroImageUrl ?? null,
        heroImageAlt:          sanity.heroImageAlt ?? null,
        ogImage:               sanity.ogImage ?? null,
        imagePrompt:           sanity.imagePrompt ?? null,
        imageGeneratedWith:    sanity.imageGeneratedWith ?? null,
        imagePhotographerName: sanity.imagePhotographerName ?? null,
        imagePhotographerUrl:  sanity.imagePhotographerUrl ?? null,
        imagePexelsUrl:        sanity.imagePexelsUrl ?? null,
        body:                  sanity.body ?? null,
        _fromSanity: true,
      };
    }
  } catch { /* fall through */ }
  return getMockArticle(slug) ?? null;
}

// ── Portable Text renderer ────────────────────────────────────────────────────

type PTSpan = { _key: string; _type: string; marks: string[]; text: string };
type PTBlock = { _key: string; _type: string; style?: string; listItem?: string; children: PTSpan[]; rows?: [string, string][] };

// Detect ✅ Do / ❌ Don't bullet pattern and collapse into a table block
function collapseDosDonts(blocks: PTBlock[]): PTBlock[] {
  const out: PTBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    const isDoHeader =
      b._type === "block" && !b.listItem &&
      b.children?.length === 1 &&
      b.children[0].marks?.includes("strong") &&
      b.children[0].text === "✅ Do";

    if (isDoHeader) {
      const doItems: string[] = [];
      i++;
      while (i < blocks.length && blocks[i].listItem === "bullet") {
        doItems.push((blocks[i].children ?? []).map((s) => s.text).join(""));
        i++;
      }
      const isDontHeader =
        i < blocks.length &&
        blocks[i]._type === "block" &&
        !blocks[i].listItem &&
        blocks[i].children?.length === 1 &&
        blocks[i].children[0].marks?.includes("strong") &&
        blocks[i].children[0].text === "❌ Don't";

      if (isDontHeader) {
        const dontItems: string[] = [];
        i++;
        while (i < blocks.length && blocks[i].listItem === "bullet") {
          dontItems.push((blocks[i].children ?? []).map((s) => s.text).join(""));
          i++;
        }
        const len = Math.max(doItems.length, dontItems.length);
        const rows: [string, string][] = Array.from({ length: len }, (_, j) => [doItems[j] ?? "", dontItems[j] ?? ""]);
        out.push({ _key: b._key, _type: "dosDontsTable", children: [], rows });
        continue;
      }
    }
    out.push(b);
    i++;
  }
  return out;
}

function renderSpans(children: PTSpan[]) {
  return children.map((span) => {
    if (span.marks.includes("strong") && span.marks.includes("em"))
      return <strong key={span._key}><em>{span.text}</em></strong>;
    if (span.marks.includes("strong")) return <strong key={span._key}>{span.text}</strong>;
    if (span.marks.includes("em"))     return <em key={span._key}>{span.text}</em>;
    return <span key={span._key}>{span.text}</span>;
  });
}

function renderBlocks(blocks: PTBlock[], alreadyProcessed = false) {
  const processed = alreadyProcessed ? blocks : collapseDosDonts(blocks);
  const out: React.ReactNode[] = [];
  let bullets: React.ReactNode[] = [];

  const flushList = (key: string) => {
    if (bullets.length) {
      out.push(<ul key={`ul-${key}`} className="list-disc pl-6 space-y-1 my-2">{bullets}</ul>);
      bullets = [];
    }
  };

  for (const block of processed) {
    if (block._type === "dosDontsTable") {
      flushList(block._key);
      const rows = block.rows ?? [];
      out.push(
        <table key={block._key} className="dos-donts-table">
          <thead>
            <tr>
              <th>✅ Do</th>
              <th>❌ Don&apos;t</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([doItem, dontItem], idx) => (
              <tr key={idx}>
                <td>{doItem}</td>
                <td>{dontItem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    if (block._type !== "block") continue;
    const content = renderSpans(block.children ?? []);

    if (block.listItem === "bullet") {
      bullets.push(<li key={block._key}>{content}</li>);
      continue;
    }
    flushList(block._key);

    switch (block.style) {
      case "h2":
        out.push(<h2 key={block._key} className="text-xl font-serif font-bold mt-8 mb-2" style={{ color: "var(--navy)" }}>{content}</h2>);
        break;
      case "h3":
        out.push(<h3 key={block._key} className="text-lg font-serif font-semibold mt-6 mb-1" style={{ color: "var(--navy)" }}>{content}</h3>);
        break;
      case "h4":
        out.push(<h4 key={block._key} className="text-base font-serif font-semibold mt-4 mb-1" style={{ color: "var(--navy)" }}>{content}</h4>);
        break;
      case "blockquote":
        out.push(<blockquote key={block._key} className="testimonial-quote">{content}</blockquote>);
        break;
      default:
        out.push(<p key={block._key}>{content}</p>);
    }
  }
  flushList("end");
  return out;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealignmenttimes.com";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section, slug } = await params;
  const article = await resolveArticle(slug);
  if (!article) return {};

  const canonicalUrl = `${SITE_URL}/${section}/${slug}`;
  const a = article as typeof article & {
    heroImageUrl?: string | null;
    ogImage?: string | null;
    coverImage?: string | null;
  };
  const ogImage =
    a.ogImage ??
    a.heroImageUrl ??
    a.coverImage ??
    `${SITE_URL}/api/og?title=${encodeURIComponent(article.title)}`;

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
      images: [a.ogImage ?? ogImage],
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

  const commentCounts = await getCommentCounts([slug]);
  const initialCommentCount = commentCounts[slug] ?? 0;

  const articleExt = article as typeof article & {
    heroImageUrl?:          string | null;
    heroImageAlt?:          string | null;
    ogImage?:               string | null;
    imageGeneratedWith?:    string | null;
    imagePhotographerName?: string | null;
    imagePhotographerUrl?:  string | null;
    imagePexelsUrl?:        string | null;
  };
  const heroImageUrl = articleExt.heroImageUrl ?? null;
  const heroImageAlt = articleExt.heroImageAlt ?? article.title;

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
            <ShareButtons url={canonicalUrl} title={article.title} slug={slug} variant="floating" />
            <button
              className="w-9 h-9 flex items-center justify-center border transition-colors hover:border-red-500"
              style={{ border: "1px solid var(--border)", color: "var(--ink-m)" }}
              title="Bookmark"
            >
              <Bookmark className="w-4 h-4" />
            </button>
          </div>

          {/* Main article */}
          <article className="lg:col-span-2">
            <header className="mb-8">
              {pillar && (
                <span className={`pillar-badge text-2xs mb-4 inline-block ${pillar.color}`}>{pillar.name}</span>
              )}

              {/* Hero image with headline overlay — shown when heroImageUrl exists */}
              {heroImageUrl ? (
                <div className="relative mb-6 overflow-hidden" style={{ aspectRatio: "16/9" }}>
                  <Image
                    src={heroImageUrl}
                    fill
                    alt={heroImageAlt}
                    className="object-cover"
                    priority
                    sizes="(max-width: 1024px) 100vw, 800px"
                  />
                  {/* Gradient overlay — dark bottom for legible headline */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to top, rgba(15,25,35,0.88) 0%, rgba(15,25,35,0.35) 55%, transparent 100%)",
                  }} />
                  {/* Headline overlay */}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "2rem 1.75rem 1.5rem" }}>
                    <h1
                      className="font-serif font-bold leading-tight mb-2"
                      style={{ color: "#fff", fontSize: "clamp(1.35rem, 3.5vw, 2.25rem)" }}
                    >
                      {article.title}
                    </h1>
                    <p className="font-serif italic" style={{ color: "rgba(245,240,232,0.78)", fontSize: "clamp(0.9rem, 2vw, 1.1rem)" }}>
                      {article.satiricalHeadline}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold leading-tight mb-4" style={{ color: "var(--navy)" }}>
                    {article.title}
                  </h1>
                  <p className="text-lg sm:text-xl font-serif italic mb-6" style={{ color: "var(--red)" }}>
                    {article.satiricalHeadline}
                  </p>
                  {/* Fallback gray hero */}
                  <div className="mb-6 rounded-sm" style={{ background: "linear-gradient(135deg, var(--navy) 0%, #1a2a3a 100%)", height: "280px" }} />
                </>
              )}

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
                  <ShareButtons url={canonicalUrl} title={article.title} slug={slug} variant="inline" />
                  <button className="p-2 border" style={{ border: "1px solid var(--border)", color: "var(--ink-m)", borderRadius: "2px" }}><Bookmark className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="rule mt-4" />
            </header>

            {/* Article body */}
            <div className="font-sans text-base leading-relaxed space-y-5" style={{ color: "var(--ink)" }}>
              {(() => {
                const body = (articleExt as { body?: unknown[] | null }).body;
                if (body?.length) {
                  const blocks = collapseDosDonts(body as PTBlock[]);
                  const mid = Math.ceil(blocks.length / 2);
                  return (
                    <>
                      {renderBlocks(blocks.slice(0, mid), true)}
                      {/* In-article subscribe prompt */}
                      <div className="my-8 p-6" style={{ background: "var(--navy)", borderRadius: "2px" }}>
                        <p className="eyebrow-gold mb-1" style={{ color: "var(--gold)" }}>The Morning Brief</p>
                        <p className="font-serif font-bold text-base mb-4" style={{ color: "var(--cream)" }}>Enjoying this? Get it in your inbox.</p>
                        <SubscribeForm source="article" articleSlug={slug} compact={false} dark />
                      </div>
                      {renderBlocks(blocks.slice(mid), true)}
                    </>
                  );
                }
                // Fallback for mock articles without body
                return <p className="drop-cap">{article.excerpt}</p>;
              })()}

              {/* Paywall gate */}
              <PaywallGate slug={slug} />
            </div>

            {/* Image credit — positioned bottom-right of hero, only for non-default sources */}
            {heroImageUrl && articleExt.imageGeneratedWith !== "pillar-default" && (
              <p
                className="image-credit"
                style={{
                  fontSize: "10px", color: "var(--ink-m)",
                  textAlign: "right", marginTop: "4px",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {articleExt.imageGeneratedWith === "pexels" ? (
                  <>
                    Photo by{" "}
                    <a
                      href={articleExt.imagePhotographerUrl ?? "https://pexels.com"}
                      target="_blank" rel="noreferrer"
                      style={{ color: "var(--ink-m)", textDecoration: "underline" }}
                    >
                      {articleExt.imagePhotographerName ?? "Photographer"}
                    </a>
                    {" "}via{" "}
                    <a
                      href={articleExt.imagePexelsUrl ?? "https://pexels.com"}
                      target="_blank" rel="noreferrer"
                      style={{ color: "var(--ink-m)", textDecoration: "underline" }}
                    >
                      Pexels
                    </a>
                  </>
                ) : (
                  "Illustration generated with AI"
                )}
              </p>
            )}

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

            {/* Inline ad — between article content and comments */}
            <AdUnit adSlot="REPLACE_WITH_INLINE_SLOT_ID" slot="inline" className="my-8" />

            <CommentSectionLoader
              articleId={slug}
              articleSlug={slug}
              articleHeadline={article.title}
              initialCount={initialCommentCount}
            />
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

              {/* Sidebar ad */}
              <AdUnit adSlot="REPLACE_WITH_SIDEBAR_SLOT_ID" slot="sidebar" />

            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
