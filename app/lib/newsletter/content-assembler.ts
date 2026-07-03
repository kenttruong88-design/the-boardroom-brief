import { createAdminClient } from "@/app/lib/supabase-server";
import { client as sanityClient } from "@/app/lib/sanity";
import { callClaude, MODELS } from "@/app/lib/claude";
import type { MarketSnapshotItem, NewsletterArticle } from "@/emails/morning-brief";

export interface MorningBriefContent {
  date: string;
  subject: string;
  introText: string;
  marketSnapshot: MarketSnapshotItem[];
  articles: NewsletterArticle[];
  waterCoolerItem: NewsletterArticle | null;
}

// Symbols in display order — maps to market_cache.symbol values
const SNAPSHOT_SYMBOLS = ["SPY", "DAX", "ISF", "EWJ", "FXI", "EWZ"] as const;

const SNAPSHOT_DISPLAY: Record<string, string> = {
  SPY: "S&P 500",
  DAX: "DAX",
  ISF: "FTSE 100",
  EWJ: "Nikkei",
  FXI: "Hang Seng",
  EWZ: "Bovespa",
};

const PILLAR_COLORS: Record<string, string> = {
  "markets-floor":  "#1e40af",
  "macro-mondays":  "#7c3aed",
  "c-suite-circus": "#0f766e",
  "global-office":  "#b45309",
  "water-cooler":   "#b8960c",
  "out-of-office":  "#0f766e",
};

interface SanityRaw {
  _id: string;
  headline: string;
  satiricalHeadline?: string;
  excerpt?: string;
  url: string;
  pillarSlug: string;
  pillar?: { name: string; slug: string; color?: string };
  heroImageUrl?: string;
  author?: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function assembleMorningBrief(date: Date): Promise<MorningBriefContent> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.thealignmenttimes.com";
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const [marketSnapshot, { mainArticles, waterCoolerItem }] = await Promise.all([
    fetchMarketSnapshot(),
    fetchArticles(siteUrl, date),
  ]);

  const introText = await generateIntroText(dateStr, marketSnapshot, mainArticles);
  const subject = buildSubject(mainArticles[0] ?? null);

  return { date: dateStr, subject, introText, marketSnapshot, articles: mainArticles, waterCoolerItem };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchMarketSnapshot(): Promise<MarketSnapshotItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("market_cache")
    .select("symbol, name, price, change_pct")
    .in("symbol", SNAPSHOT_SYMBOLS)
    .order("pulled_at", { ascending: false });

  if (error) console.error("[newsletter/content-assembler] market_cache fetch failed:", error.message);
  if (!data?.length) return [];

  const rows = data as { symbol: string; name: string; price: number; change_pct: number }[];
  const latest = new Map<string, (typeof rows)[0]>();
  for (const row of rows) {
    if (!latest.has(row.symbol)) latest.set(row.symbol, row);
  }

  return SNAPSHOT_SYMBOLS.flatMap((sym) => {
    const row = latest.get(sym);
    if (!row) return [];
    return [{
      symbol: SNAPSHOT_DISPLAY[sym] ?? sym,
      name: row.name,
      price: row.price.toLocaleString("en-US", { maximumFractionDigits: 2 }),
      changePct: `${row.change_pct >= 0 ? "+" : ""}${row.change_pct.toFixed(2)}%`,
      direction: (row.change_pct > 0 ? "up" : row.change_pct < 0 ? "down" : "flat") as "up" | "down" | "flat",
    }];
  });
}

async function fetchArticles(
  siteUrl: string,
  date: Date
): Promise<{ mainArticles: NewsletterArticle[]; waterCoolerItem: NewsletterArticle | null }> {
  if (!sanityClient) return { mainArticles: [], waterCoolerItem: null };

  const since = new Date(date.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const raw = await sanityClient.fetch<SanityRaw[]>(
    `*[_type == "article" && publishedAt >= $since] | order(featured desc, publishedAt desc) [0...7] {
      _id,
      "headline": title,
      satiricalHeadline,
      excerpt,
      "url": $siteUrl + "/" + pillar->slug.current + "/" + slug.current,
      "pillarSlug": pillar->slug.current,
      "pillar": pillar->{ name, "slug": slug.current, color },
      heroImageUrl,
      "author": author->name
    }`,
    { since, siteUrl }
  );

  const toArticle = (a: SanityRaw): NewsletterArticle => ({
    headline: a.headline,
    satiricalHeadline: a.satiricalHeadline ?? "",
    excerpt: a.excerpt ?? "",
    url: a.url,
    pillar: a.pillar?.name ?? "The Alignment Times",
    pillarColor: a.pillar?.color ?? PILLAR_COLORS[a.pillarSlug] ?? "#c8391a",
    imageUrl: a.heroImageUrl ?? undefined,
    author: a.author ?? undefined,
  });

  const waterCoolerRaw = raw.filter((a) => a.pillarSlug === "water-cooler");
  const mainRaw = raw.filter((a) => a.pillarSlug !== "water-cooler").slice(0, 4);

  return {
    mainArticles: mainRaw.map(toArticle),
    waterCoolerItem: waterCoolerRaw.length > 0 ? toArticle(waterCoolerRaw[0]) : null,
  };
}

async function generateIntroText(
  dateStr: string,
  markets: MarketSnapshotItem[],
  articles: NewsletterArticle[]
): Promise<string> {
  const sp500 = markets.find((m) => m.symbol === "S&P 500");
  const dax = markets.find((m) => m.symbol === "DAX");
  const movers = markets
    .filter((m) => m.direction !== "flat")
    .slice(0, 4)
    .map((m) => `${m.symbol} ${m.changePct}`)
    .join(", ");

  const userPrompt = [
    `Date: ${dateStr}`,
    sp500 ? `S&P 500: ${sp500.changePct}, DAX: ${dax?.changePct ?? "n/a"}` : "",
    movers ? `Key moves: ${movers}` : "",
    articles[0] ? `Lead story: ${articles[0].headline}` : "",
    "",
    "Write a 2-sentence newsletter opener. Do not start with 'Good morning'. Do not use the word 'exciting'. Return plain text only.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { content } = await callClaude(
      `You write the opening 2-3 sentences of The Alignment Times morning newsletter. Dry, informed, never cheesy. Reference what actually happened in markets overnight. Tone: a smart colleague who read all the news before you woke up.`,
      userPrompt,
      150,
      "newsletter/intro",
      MODELS.fast
    );
    return content.trim();
  } catch {
    return "Markets moved. News happened. The details are below.";
  }
}

function buildSubject(lead: NewsletterArticle | null): string {
  if (!lead) return "The Alignment Times — Today's Edition";
  const candidate = (lead.satiricalHeadline || lead.headline).trim();
  const truncated = candidate.length > 60 ? candidate.slice(0, 57) + "…" : candidate;
  return `${truncated} | The Alignment Times`;
}
