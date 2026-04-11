import { MetadataRoute } from "next";
import { PILLARS, ECONOMIES } from "@/app/lib/mock-data";
import { getAllArticleSlugs } from "@/app/lib/queries";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealignmenttimes.com";

export const revalidate = 86400; // 24h

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // Static pages
  const statics: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/economies`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/subscribe`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Pillar pages
  const pillars: MetadataRoute.Sitemap = PILLARS.map((p) => ({
    url: `${SITE_URL}/${p.slug}`,
    lastModified: now,
    changeFrequency: "hourly" as const,
    priority: 0.9,
  }));

  // Economy pages
  const economies: MetadataRoute.Sitemap = ECONOMIES.map((e) => ({
    url: `${SITE_URL}/economies/${e.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Article pages from Sanity
  let articles: MetadataRoute.Sitemap = [];
  try {
    const slugs = await getAllArticleSlugs();
    articles = slugs.map(({ section, slug }) => ({
      url: `${SITE_URL}/${section}/${slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch { /* fall through with empty articles */ }

  return [...statics, ...pillars, ...economies, ...articles];
}
