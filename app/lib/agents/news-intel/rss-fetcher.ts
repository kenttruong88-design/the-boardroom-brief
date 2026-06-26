/**
 * rss-fetcher.ts
 * Fetches Google News RSS feeds by query string — completely free, no API key.
 * Returns structured items suitable for Claude scoring.
 */

export interface RSSItem {
  headline: string;
  description: string;
  url: string;
  sourceName: string;
  publishedAt: string;
}

// ── XML helpers ───────────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  // Handles both CDATA and plain text variants
  const cdataRe = new RegExp(`<${tag}[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/${tag}>`, "i");
  const plainRe  = new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, "i");
  const m = xml.match(cdataRe) ?? xml.match(plainRe);
  return (m?.[1] ?? "").trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Google News RSS titles end with " - Publication Name". Strip and return both. */
function splitTitle(raw: string): { headline: string; sourceName: string } {
  const lastDash = raw.lastIndexOf(" - ");
  if (lastDash > 20) {
    return {
      headline:   raw.slice(0, lastDash).trim(),
      sourceName: raw.slice(lastDash + 3).trim(),
    };
  }
  return { headline: raw, sourceName: "" };
}

/** Parse <source url="...">Name</source> attribute */
function extractSource(itemXml: string): string {
  const m = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
  return m ? stripHtml(m[1]) : "";
}

// ── fetchRSSFeed ──────────────────────────────────────────────────────────────

const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search";
const USER_AGENT =
  "Mozilla/5.0 (compatible; AlignmentTimes-NewsBot/1.0)";

export async function fetchRSSFeed(
  query: string,
  maxItems = 15
): Promise<RSSItem[]> {
  const url =
    `${GOOGLE_NEWS_BASE}?q=${encodeURIComponent(query)}` +
    `&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(12_000),
      // Never cache — always want today's news
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[rss-fetcher] HTTP ${res.status} for query: "${query}"`);
      return [];
    }

    const xml = await res.text();
    const items: RSSItem[] = [];

    // Extract each <item> block
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const itemXml = m[1];

      const rawTitle   = stripHtml(extractTag(itemXml, "title"));
      const rawDesc    = stripHtml(extractTag(itemXml, "description"));
      const pubDate    = extractTag(itemXml, "pubDate");
      const sourceAttr = extractSource(itemXml);

      // Link is sometimes a self-closing element or between tags
      const linkM =
        itemXml.match(/<link>([^<]+)<\/link>/i) ??
        itemXml.match(/<link\/>\s*([^<\s][^<]*)/i);
      const url = (linkM?.[1] ?? "").trim();

      if (!rawTitle || !url) continue;

      const { headline, sourceName: titleSource } = splitTitle(rawTitle);
      const sourceName = sourceAttr || titleSource;

      // Skip items with no useful description
      if (!headline) continue;

      items.push({ headline, description: rawDesc, url, sourceName, publishedAt: pubDate });

      if (items.length >= maxItems) break;
    }

    return items;
  } catch (err) {
    console.warn(`[rss-fetcher] Fetch failed for "${query}":`, (err as Error).message);
    return [];
  }
}

/**
 * Fetch multiple RSS queries and deduplicate by headline.
 * Used to build the full item batch for one pillar.
 */
export async function fetchPillarFeeds(queries: string[]): Promise<RSSItem[]> {
  const results = await Promise.all(queries.map((q) => fetchRSSFeed(q)));
  const flat = results.flat();

  // Deduplicate by normalised headline
  const seen = new Set<string>();
  return flat.filter((item) => {
    const key = item.headline.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
