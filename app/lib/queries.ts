import { client as _client } from "./sanity";
import { cache } from "react";

// If Sanity isn't configured, all queries return empty results
const client = _client;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SanityArticle {
  _id: string;
  title: string;
  slug: { current: string };
  satiricalHeadline?: string;
  excerpt?: string;
  publishedAt: string;
  readTime?: number;
  featured?: boolean;
  coverImage?: { asset: { url: string }; alt?: string };
  pillar?: { name: string; slug: { current: string }; color?: string };
  author?: { name: string; slug: { current: string }; avatar?: { asset: { url: string } } };
  tags?: { name: string; slug: { current: string } }[];
  countries?: { name: string; slug: { current: string }; code?: string }[];
}

export interface SanityArticleFull extends SanityArticle {
  body?: unknown[];
  seoTitle?: string;
  seoDescription?: string;
}

// ─── Fragments ───────────────────────────────────────────────────────────────

const ARTICLE_CARD = `
  _id,
  title,
  slug,
  satiricalHeadline,
  excerpt,
  publishedAt,
  readTime,
  featured,
  coverImage { asset->{ url }, alt },
  pillar->{ name, slug, color },
  author->{ name, slug },
  tags[]->{ name, slug },
  countries[]->{ name, slug, code }
`;

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Latest N articles across all pillars */
export const getLatestArticles = cache(async (limit = 10): Promise<SanityArticle[]> => {
  if (!client) return [];
  return client.fetch(
    `*[_type == "article"] | order(publishedAt desc) [0...$limit] { ${ARTICLE_CARD} }`,
    { limit: limit - 1 },
    { next: { revalidate: 60 } }
  );
});

/** Featured articles for the homepage hero */
export const getFeaturedArticles = cache(async (limit = 5): Promise<SanityArticle[]> => {
  if (!client) return [];
  return client.fetch(
    `*[_type == "article" && featured == true] | order(publishedAt desc) [0...$limit] { ${ARTICLE_CARD} }`,
    { limit: limit - 1 },
    { next: { revalidate: 60 } }
  );
});

/** Articles by pillar slug */
export const getArticlesByPillar = cache(async (pillarSlug: string, limit = 20): Promise<SanityArticle[]> => {
  if (!client) return [];
  return client.fetch(
    `*[_type == "article" && pillar->slug.current == $pillarSlug] | order(publishedAt desc) [0...$limit] { ${ARTICLE_CARD} }`,
    { pillarSlug, limit: limit - 1 },
    { next: { revalidate: 60 } }
  );
});

/** Single article by slug (full content) */
export const getArticleBySlug = cache(async (slug: string): Promise<SanityArticleFull | null> => {
  if (!client) return null;
  const results = await client.fetch(
    `*[_type == "article" && slug.current == $slug][0] {
      ${ARTICLE_CARD},
      body,
      seoTitle,
      seoDescription
    }`,
    { slug },
    { next: { revalidate: 60 } }
  );
  return results ?? null;
});

/** Articles by country slug */
export const getArticlesByCountry = cache(async (countrySlug: string, limit = 12): Promise<SanityArticle[]> => {
  if (!client) return [];
  return client.fetch(
    `*[_type == "article" && $countrySlug in countries[]->slug.current] | order(publishedAt desc) [0...$limit] { ${ARTICLE_CARD} }`,
    { countrySlug, limit: limit - 1 },
    { next: { revalidate: 60 } }
  );
});

/** All pillar slugs (for generateStaticParams) */
export const getAllPillarSlugs = cache(async (): Promise<string[]> => {
  if (!client) return [];
  const pillars = await client.fetch(`*[_type == "pillar"]{ "slug": slug.current }`);
  return pillars.map((p: { slug: string }) => p.slug);
});

/** All article slugs with their pillar (for generateStaticParams) */
export const getAllArticleSlugs = cache(async (): Promise<{ section: string; slug: string }[]> => {
  if (!client) return [];
  const articles = await client.fetch(
    `*[_type == "article"]{ "slug": slug.current, "section": pillar->slug.current }`
  );
  return articles.filter((a: { section: string; slug: string }) => a.section && a.slug);
});

/** All country slugs (for generateStaticParams) */
export const getAllCountrySlugs = cache(async (): Promise<string[]> => {
  if (!client) return [];
  const countries = await client.fetch(`*[_type == "country"]{ "slug": slug.current }`);
  return countries.map((c: { slug: string }) => c.slug);
});
