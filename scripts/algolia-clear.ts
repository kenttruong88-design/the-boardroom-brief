/**
 * Clears all objects from the Algolia index. Irreversible — requires "CONFIRM" arg.
 *
 * Usage:  npm run algolia:clear CONFIRM
 */
import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import algoliasearch from "algoliasearch";
import { INDEX_NAME } from "../app/lib/search/algolia-config";

if (process.argv[2] !== "CONFIRM") {
  console.error('❌  Must pass "CONFIRM" to clear the index: npm run algolia:clear CONFIRM');
  process.exit(1);
}

const appId    = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const adminKey = process.env.ALGOLIA_ADMIN_KEY;

if (!appId || !adminKey) {
  console.error("❌  NEXT_PUBLIC_ALGOLIA_APP_ID and ALGOLIA_ADMIN_KEY are required");
  process.exit(1);
}

const client = algoliasearch(appId, adminKey);
const index  = client.initIndex(INDEX_NAME);

async function main() {
  console.log(`\n⚠️   Clearing ALL objects from index: ${INDEX_NAME}`);
  await index.clearObjects();
  console.log("✅  Index cleared\n");
}

main().catch((err) => {
  console.error("❌  Clear failed:", err);
  process.exit(1);
});
