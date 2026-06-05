import { NextResponse } from "next/server";
import { getSearchClient, INDEX_NAME, AlgoliaArticle } from "@/app/lib/algolia";
import { rateLimit, ipKey } from "@/app/lib/rate-limit";
import { createAdminClient } from "@/app/lib/supabase-server";

export async function GET(req: Request) {
  if (!rateLimit(ipKey(req, "search"), 60, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const query       = searchParams.get("q")?.trim() ?? "";
  const pillarSlug  = searchParams.get("pillar")?.trim() ?? "";
  const page        = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));

  if (query.length < 2) {
    return NextResponse.json({ hits: [], nbHits: 0, nbPages: 0 });
  }

  const client = getSearchClient();
  if (!client) {
    return NextResponse.json({ error: "Search not configured." }, { status: 503 });
  }

  try {
    const index = client.initIndex(INDEX_NAME);
    const { hits, nbHits, nbPages } = await index.search<AlgoliaArticle>(query, {
      hitsPerPage: 10,
      page,
      attributesToRetrieve: [
        "title", "satiricalHeadline", "excerpt", "slug",
        "pillarSlug", "pillarName", "pillarColor", "heroImageUrl",
        "publishedAt", "tags", "countries", "tone", "authorPersona",
      ],
      attributesToHighlight: ["title", "satiricalHeadline", "excerpt"],
      highlightPreTag: "<mark>",
      highlightPostTag: "</mark>",
      ...(pillarSlug ? { filters: `pillarSlug:${pillarSlug}` } : {}),
    });

    // Log to analytics (fire-and-forget)
    logSearchAnalytics(query, pillarSlug || null, hits.length).catch(() => {});

    return NextResponse.json({ hits, nbHits, nbPages });
  } catch (err) {
    console.error("[search]", err);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}

async function logSearchAnalytics(query: string, pillarFilter: string | null, resultCount: number) {
  try {
    const supabase = createAdminClient();
    await supabase.from("search_analytics").insert({
      query,
      pillar_filter: pillarFilter,
      result_count: resultCount,
    });
  } catch {
    // Table may not exist yet; silent fail
  }
}
