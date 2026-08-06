import { cache } from "react";
import { createAdminClient } from "./supabase-server";

export interface CompatibilityDimension {
  label: string;
  score: number;
  blurb: string;
}

export interface CompatibilitySourceArticle {
  slug: string;
  section: string;
  title: string;
}

export interface CompatibilityRow {
  id: string;
  country_a_slug: string;
  country_a_name: string;
  country_b_slug: string;
  country_b_name: string;
  overall_score: number;
  verdict: string;
  dimensions: CompatibilityDimension[];
  source_articles: CompatibilitySourceArticle[];
  generated_at: string;
}

export interface CompatibilityMatch {
  otherSlug: string;
  otherName: string;
  overallScore: number;
  verdict: string;
  dimensions: CompatibilityDimension[];
  sourceArticles: CompatibilitySourceArticle[];
}

/** Every country that has at least one Compatibility Index score, for the picker. */
export const getScoredCountries = cache(async (): Promise<{ slug: string; name: string }[]> => {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("country_compatibility")
    .select("country_a_slug, country_a_name, country_b_slug, country_b_name");
  if (!data) return [];

  const byslug = new Map<string, string>();
  for (const row of data) {
    byslug.set(row.country_a_slug, row.country_a_name);
    byslug.set(row.country_b_slug, row.country_b_name);
  }
  return [...byslug.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

/** All of one country's Compatibility Index matches, ranked highest-first. */
export const getCompatibilityForCountry = cache(async (countrySlug: string): Promise<CompatibilityMatch[]> => {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("country_compatibility")
    .select("*")
    .or(`country_a_slug.eq.${countrySlug},country_b_slug.eq.${countrySlug}`);
  if (!data) return [];

  return (data as CompatibilityRow[])
    .map((row) => {
      const isA = row.country_a_slug === countrySlug;
      return {
        otherSlug: isA ? row.country_b_slug : row.country_a_slug,
        otherName: isA ? row.country_b_name : row.country_a_name,
        overallScore: row.overall_score,
        verdict: row.verdict,
        dimensions: row.dimensions,
        sourceArticles: row.source_articles,
      };
    })
    .sort((a, b) => b.overallScore - a.overallScore);
});
