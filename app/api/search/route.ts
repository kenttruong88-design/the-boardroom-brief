import { NextResponse } from "next/server";
import { getSearchClient, INDEX_NAME, AlgoliaArticle } from "@/app/lib/algolia";
import { rateLimit, ipKey } from "@/app/lib/rate-limit";

export async function GET(req: Request) {
  if (!rateLimit(ipKey(req, "search"), 60, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ hits: [] });
  }

  const client = getSearchClient();
  if (!client) {
    return NextResponse.json({ error: "Search not configured." }, { status: 503 });
  }

  try {
    const index = client.initIndex(INDEX_NAME);
    const { hits } = await index.search<AlgoliaArticle>(query, {
      hitsPerPage: 8,
      attributesToRetrieve: [
        "title",
        "satiricalHeadline",
        "excerpt",
        "slug",
        "pillarSlug",
        "pillarName",
        "pillarColor",
        "heroImageUrl",
        "publishedAt",
      ],
      attributesToHighlight: ["title", "satiricalHeadline", "excerpt"],
      highlightPreTag: "<mark>",
      highlightPostTag: "</mark>",
    });

    return NextResponse.json({ hits });
  } catch (err) {
    console.error("[search]", err);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
