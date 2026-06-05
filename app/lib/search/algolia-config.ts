export const INDEX_NAME =
  process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME ?? "alignment_times_articles";

export const INDEX_SETTINGS = {
  searchableAttributes: [
    "unordered(title)",
    "unordered(satiricalHeadline)",
    "unordered(excerpt)",
    "unordered(tags)",
    "pillarName",
    "authorPersona",
  ],
  customRanking: ["desc(publishedAt)", "desc(featured)"],
  attributesForFaceting: [
    "searchable(pillarSlug)",
    "searchable(pillarName)",
    "searchable(tags)",
    "countries",
    "tone",
  ],
  attributesToSnippet: ["excerpt:20"],
  snippetEllipsisText: "…",
  attributesToHighlight: ["title", "satiricalHeadline", "excerpt"],
  highlightPreTag: "<mark>",
  highlightPostTag: "</mark>",
  distinct: false,
  hitsPerPage: 10,
  queryLanguages: ["en"],
  removeStopWords: true,
  ignorePlurals: true,
} as const;
