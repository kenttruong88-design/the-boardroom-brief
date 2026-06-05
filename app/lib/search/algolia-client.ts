import algoliasearch from "algoliasearch";

/** Server-side admin client — uses ALGOLIA_ADMIN_KEY. Never expose to browser. */
export function createAdminClient() {
  const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
  const adminKey = process.env.ALGOLIA_ADMIN_KEY;
  if (!appId || !adminKey) return null;
  return algoliasearch(appId, adminKey);
}

/** Server-side search client — uses NEXT_PUBLIC_ALGOLIA_SEARCH_KEY. Safe for proxy routes. */
export function createSearchClient() {
  const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
  const searchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;
  if (!appId || !searchKey) return null;
  return algoliasearch(appId, searchKey);
}
