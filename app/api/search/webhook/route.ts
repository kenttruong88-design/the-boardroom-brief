import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getAdminClient, INDEX_NAME, toAlgoliaRecord, ARTICLE_FOR_INDEX_GROQ } from "@/app/lib/algolia";
import { createClient } from "@sanity/client";

// Sanity webhook — triggered on article publish/unpublish/delete.
// Configure at manage.sanity.io → API → Webhooks:
//   URL:    https://your-domain.com/api/search/webhook
//   Secret: SANITY_WEBHOOK_SECRET  (set as header secret)
//   Filter: _type == "article"
//   HTTP method: POST

function verifySanitySignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  // Header format: t=<unix-ms>,v1=<hex-digest>
  const parts = Object.fromEntries(signatureHeader.split(",").map((p) => p.split("=")));
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return expected === signature;
}

export async function POST(req: Request) {
  const secret = process.env.SANITY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("sanity-signature") ?? req.headers.get("sanity-webhook-signature") ?? "";

  // Accept both HMAC signature (production) and plain secret (dev/testing via query param)
  const querySecret = new URL(req.url).searchParams.get("secret");
  const signatureValid = signatureHeader
    ? verifySanitySignature(rawBody, signatureHeader, secret)
    : querySecret === secret;

  if (!signatureValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { _id?: string; _type?: string; _deletedAt?: string; operation?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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

  // Delete / unpublish: remove from index
  const isDelete = body._deletedAt || body.operation === "delete" || docId.startsWith("drafts.");
  if (isDelete) {
    const cleanId = docId.replace(/^drafts\./, "");
    await index.deleteObject(cleanId).catch(() => {});
    return NextResponse.json({ deleted: cleanId });
  }

  // Publish: re-fetch the full document from Sanity and upsert
  const sanity = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset:   process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    useCdn:    false,
    token:     process.env.SANITY_API_TOKEN,
  });

  const doc = await sanity.fetch(
    `*[_id == $id && defined(publishedAt) && !(_id in path("drafts.**"))][0] ${ARTICLE_FOR_INDEX_GROQ}`,
    { id: docId }
  );

  if (!doc) {
    // Unpublished or draft — remove from index
    await index.deleteObject(docId.replace(/^drafts\./, "")).catch(() => {});
    return NextResponse.json({ deleted: docId });
  }

  const record = toAlgoliaRecord(doc);
  await index.saveObject(record);

  return NextResponse.json({ indexed: record.objectID });
}
