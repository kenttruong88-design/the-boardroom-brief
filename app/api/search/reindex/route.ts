import { NextResponse } from "next/server";
import {
  getAdminClient,
  INDEX_NAME,
  toAlgoliaRecord,
  ARTICLE_FOR_INDEX_GROQ,
} from "@/app/lib/algolia";
import { createClient } from "@sanity/client";

export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret")
    ?? req.headers.get("authorization")?.replace("Bearer ", "");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = getAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Algolia not configured." }, { status: 503 });
  }

  const sanity = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset:   process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    useCdn:    false,
    token:     process.env.SANITY_API_TOKEN,
  });

  const query = `*[_type == "article" && defined(publishedAt) && !(_id in path("drafts.**"))] | order(publishedAt desc) ${ARTICLE_FOR_INDEX_GROQ}`;

  const docs = await sanity.fetch(query);

  const records = docs.map(toAlgoliaRecord);

  const index = adminClient.initIndex(INDEX_NAME);

  // Configure index settings on first run
  await index.setSettings({
    searchableAttributes: [
      "unordered(title)",
      "unordered(satiricalHeadline)",
      "unordered(excerpt)",
      "unordered(tags)",
      "pillarName",
    ],
    customRanking: ["desc(publishedAt)", "desc(featured)"],
    attributesForFaceting: ["pillarSlug", "pillarName", "tags"],
    attributesToSnippet: ["excerpt:20"],
    snippetEllipsisText: "…",
  });

  // Atomic replace — zero downtime, old records deleted automatically
  const { objectIDs } = await index.replaceAllObjects(records, { safe: true });

  return NextResponse.json({
    indexed: objectIDs.length,
    index:   INDEX_NAME,
  });
}
