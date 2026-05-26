import algoliasearch from "algoliasearch";

export const INDEX_NAME =
  process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME ?? "alignment_times_articles";

/** Admin client — server-only (uses ALGOLIA_ADMIN_KEY, never expose to browser) */
export function getAdminClient() {
  const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
  const adminKey = process.env.ALGOLIA_ADMIN_KEY;
  if (!appId || !adminKey) return null;
  return algoliasearch(appId, adminKey);
}

/** Search client — uses search-only key, safe for server-side search proxy */
export function getSearchClient() {
  const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
  const searchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;
  if (!appId || !searchKey) return null;
  return algoliasearch(appId, searchKey);
}

// ── Record shape ──────────────────────────────────────────────────────────────

export interface AlgoliaArticle {
  objectID: string;       // Sanity _id
  title: string;
  satiricalHeadline: string | null;
  excerpt: string;
  slug: string;
  pillarSlug: string;
  pillarName: string;
  pillarColor: string | null;
  publishedAt: number;    // Unix timestamp — used for ranking/sorting
  featured: boolean;
  heroImageUrl: string | null;
  tags: string[];
}

// ── Sanity → Algolia transformer ──────────────────────────────────────────────

interface RawSanityArticle {
  _id: string;
  title: string;
  satiricalHeadline?: string | null;
  excerpt?: string | null;
  slug: string;
  pillarSlug: string;
  pillarName: string;
  pillarColor?: string | null;
  publishedAt: string;
  featured?: boolean;
  heroImageUrl?: string | null;
  tags?: string[];
}

export function toAlgoliaRecord(doc: RawSanityArticle): AlgoliaArticle {
  return {
    objectID:          doc._id,
    title:             doc.title,
    satiricalHeadline: doc.satiricalHeadline ?? null,
    excerpt:           doc.excerpt ?? "",
    slug:              doc.slug,
    pillarSlug:        doc.pillarSlug,
    pillarName:        doc.pillarName,
    pillarColor:       doc.pillarColor ?? null,
    publishedAt:       new Date(doc.publishedAt).getTime() / 1000,
    featured:          doc.featured ?? false,
    heroImageUrl:      doc.heroImageUrl ?? null,
    tags:              doc.tags ?? [],
  };
}

// ── GROQ query (used by both reindex and webhook routes) ─────────────────────

export const ARTICLE_FOR_INDEX_GROQ = `{
  _id,
  title,
  satiricalHeadline,
  excerpt,
  "slug": slug.current,
  "pillarSlug": pillar->slug.current,
  "pillarName": pillar->name,
  "pillarColor": pillar->color,
  publishedAt,
  featured,
  heroImageUrl,
  "tags": tags[]->name
}`;
