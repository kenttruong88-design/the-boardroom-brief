// Central re-export — existing API routes import from here.
// New code should import directly from app/lib/search/*.
export { INDEX_NAME } from "@/app/lib/search/algolia-config";
export { createAdminClient as getAdminClient, createSearchClient as getSearchClient } from "@/app/lib/search/algolia-client";
export type { AlgoliaArticleRecord as AlgoliaArticle } from "@/app/lib/search/algolia-record";
export { toAlgoliaRecord, ARTICLE_FOR_INDEX_GROQ } from "@/app/lib/search/algolia-record";
