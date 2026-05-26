import { NextResponse } from "next/server";
import {
  getAdminClient,
  INDEX_NAME,
  toAlgoliaRecord,
  ARTICLE_FOR_INDEX_GROQ,
} from "@/app/lib/algolia";
import { createClient } from "@sanity/client";

// Triggered by a Sanity webhook on document publish/delete.
// Configure the webhook at manage.sanity.io:
//   URL: https://your-domain.com/api/search/webhook
//   Secret: SANITY_WEBHOOK_SECRET
//   Filter: _type == "article"
//   Projections: leave empty (we re-fetch from Sanity for complete data)

export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.SANITY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    _id?: string;
    _type?: string;
    _deletedAt?: string;
  };

  if (body._type !== "article") {
    return NextResponse.json({ skipped: true });
  }

  const docId = body._id;
  if (!docId) {
    return NextResponse.json({ error: "Missing _id" }, { status: 400 });
  }

  const adminClient = getAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Algolia not configured." }, { status: 503 });
  }

  const index = adminClient.initIndex(INDEX_NAME);

  // Delete event (document deleted or unpublished)
  if (body._deletedAt || docId.startsWith("drafts.")) {
    const cleanId = docId.replace("drafts.", "");
    await index.deleteObject(cleanId).catch(() => {});
    return NextResponse.json({ deleted: cleanId });
  }

  // Publish event — re-fetch the full record from Sanity
  const sanity = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset:   process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    useCdn:    false,
    token:     process.env.SANITY_API_TOKEN,
  });

  const doc = await sanity.fetch(
    `*[_id == $id && defined(publishedAt)][0] ${ARTICLE_FOR_INDEX_GROQ}`,
    { id: docId }
  );

  if (!doc) {
    // Draft or unpublished — remove from index if it was there
    await index.deleteObject(docId).catch(() => {});
    return NextResponse.json({ deleted: docId });
  }

  const record = toAlgoliaRecord(doc);
  await index.saveObject(record);

  return NextResponse.json({ indexed: record.objectID });
}
