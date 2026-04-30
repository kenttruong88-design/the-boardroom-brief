import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { client, writeClient } from "@/app/lib/sanity";

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (!client || !writeClient) {
    return NextResponse.json({ error: "Sanity not configured" }, { status: 500 });
  }

  // Articles missing heroImageUrl but potentially having ogImage or old featuredImage data
  const articles = await client.fetch<Array<{
    _id: string;
    title: string;
    ogImage?: string;
    featuredImage?: { asset?: { url?: string }; alt?: string };
  }>>(
    `*[_type == "article" && !defined(heroImageUrl)] {
      _id, title, ogImage,
      featuredImage { asset { url }, alt }
    }`
  );

  if (articles.length === 0) {
    return NextResponse.json({ patched: 0, message: "All articles already have heroImageUrl" });
  }

  let patched = 0;
  const skipped: string[] = [];

  for (const article of articles) {
    // ogImage was stored as a plain string URL (correct); prefer it over the broken asset reference
    const heroImageUrl =
      article.ogImage ??
      article.featuredImage?.asset?.url ??
      null;

    if (!heroImageUrl) {
      skipped.push(article._id);
      continue;
    }

    await writeClient
      .patch(article._id)
      .set({
        heroImageUrl,
        heroImageAlt: article.featuredImage?.alt ?? article.title,
      })
      .commit();

    patched++;
  }

  return NextResponse.json({
    total: articles.length,
    patched,
    skipped: skipped.length,
    skippedIds: skipped,
  });
}
