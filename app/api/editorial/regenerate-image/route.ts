import { NextResponse } from "next/server";
import { requireAuth, loadDigest, saveDigest, resolveIndex, todayDate } from "../_helpers";
import { generateArticleImage } from "@/app/lib/agents/image-generator";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as { articleId: string; digestDate?: string };
  const index = resolveIndex(body.articleId);
  if (index < 0) return NextResponse.json({ error: "Invalid articleId" }, { status: 400 });

  const date = body.digestDate ?? todayDate();
  const row = await loadDigest(date);
  if (!row) return NextResponse.json({ error: "No digest for that date" }, { status: 404 });

  const entry = row.digest_json.articles[index];
  if (!entry) return NextResponse.json({ error: "Article not found" }, { status: 404 });

  let imageResult;
  try {
    imageResult = await generateArticleImage(entry.draft);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const featuredImage = {
    cloudinaryPublicId:  imageResult.publicId,
    url:                 imageResult.url,
    heroUrl:             imageResult.heroUrl,
    thumbnailUrl:        imageResult.thumbnailUrl,
    ogImageUrl:          imageResult.ogImageUrl,
    mobileUrl:           imageResult.mobileUrl,
    altText:             entry.draft.headline,
    source:              imageResult.source,
    generatedPrompt:     imageResult.generatedPrompt,
    photographerName:    imageResult.photographerName,
    photographerUrl:     imageResult.photographerUrl,
    pexelsPageUrl:       imageResult.pexelsPageUrl,
    durationMs:          imageResult.durationMs,
  };

  const digest = row.digest_json;
  digest.articles[index].draft.featuredImage = featuredImage;
  await saveDigest(digest, date);

  return NextResponse.json({ success: true, featuredImage });
}
