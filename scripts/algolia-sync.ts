/**
 * Full Algolia index sync — fetches every published article from Sanity and
 * atomically replaces the index contents. Zero downtime (replaceAllObjects).
 *
 * Usage:  npm run algolia:sync
 */
import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import algoliasearch from "algoliasearch";
import { createClient } from "@sanity/client";
import { toAlgoliaRecord, ARTICLE_FOR_INDEX_GROQ } from "../app/lib/search/algolia-record";
import { INDEX_NAME, INDEX_SETTINGS } from "../app/lib/search/algolia-config";

const appId    = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const adminKey = process.env.ALGOLIA_ADMIN_KEY;
const sanityId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset  = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const apiToken = process.env.SANITY_API_TOKEN;

if (!appId || !adminKey) {
  console.error("❌  NEXT_PUBLIC_ALGOLIA_APP_ID and ALGOLIA_ADMIN_KEY are required");
  process.exit(1);
}
if (!sanityId || !apiToken) {
  console.error("❌  NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_TOKEN are required");
  process.exit(1);
}

const client  = algoliasearch(appId, adminKey);
const index   = client.initIndex(INDEX_NAME);
const sanity  = createClient({ projectId: sanityId, dataset, apiVersion: "2024-01-01", useCdn: false, token: apiToken });

async function main() {
  console.log(`\n📡  Fetching articles from Sanity (dataset: ${dataset})…`);
  const query = `*[_type == "article" && defined(publishedAt) && !(_id in path("drafts.**"))] | order(publishedAt desc) ${ARTICLE_FOR_INDEX_GROQ}`;
  const docs = await sanity.fetch(query);
  console.log(`   Found ${docs.length} published articles`);

  console.log("⚙️   Applying index settings…");
  await index.setSettings(INDEX_SETTINGS as Parameters<typeof index.setSettings>[0]);

  console.log("🔁  Replacing index objects (atomic, zero downtime)…");
  const records = docs.map(toAlgoliaRecord);
  const { objectIDs } = await index.replaceAllObjects(records, { safe: true });

  console.log(`✅  Indexed ${objectIDs.length} records → ${INDEX_NAME}\n`);
}

main().catch((err) => {
  console.error("❌  Sync failed:", err);
  process.exit(1);
});
