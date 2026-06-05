export interface AlgoliaArticleRecord {
  objectID: string;
  title: string;
  satiricalHeadline: string | null;
  excerpt: string;
  slug: string;
  pillarSlug: string;
  pillarName: string;
  pillarColor: string | null;
  publishedAt: number;      // Unix timestamp (seconds) — used for ranking
  featured: boolean;
  heroImageUrl: string | null;
  tags: string[];
  // Extended fields
  countries: string[];      // economy slugs, e.g. ["us", "uk"]
  authorPersona: string | null;
  tone: "satire" | "straight" | "hybrid" | null;
}

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
  countries?: string[];
  authorPersona?: string | null;
  tone?: string | null;
}

export function toAlgoliaRecord(doc: RawSanityArticle): AlgoliaArticleRecord {
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
    countries:         doc.countries ?? [],
    authorPersona:     doc.authorPersona ?? null,
    tone:              (doc.tone as AlgoliaArticleRecord["tone"]) ?? null,
  };
}

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
  "tags": tags[]->name,
  "countries": coalesce(countries, []),
  "authorPersona": coalesce(agentName, null),
  "tone": coalesce(tone, null)
}`;
