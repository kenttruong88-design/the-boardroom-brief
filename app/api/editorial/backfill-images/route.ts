import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { client, writeClient } from "@/app/lib/sanity";
import { uploadToCloudinary } from "@/app/lib/agents/image-generator";

export const maxDuration = 300;

function isCronAuthorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") ?? "";
  const header = req.headers.get("x-cron-secret") ?? "";
  return bearer === `Bearer ${secret}` || header === secret;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// Cap per invocation so a large backlog can't run past Vercel's function
// timeout (maxDuration above) — the daily cron just chips away at it.
const DEFAULT_BATCH_SIZE = 25;

/** Scheduled entry point — Vercel Cron calls scheduled paths via GET. */
export async function GET(req: NextRequest) {
  if (!isCronAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const count = parseInt(req.nextUrl.searchParams.get("count") ?? "") || DEFAULT_BATCH_SIZE;
  return runBackfill(count);
}

/** Manual/admin entry point — triggered from the editorial UI. */
export async function POST(req: NextRequest) {
  if (!isCronAuthorised(req)) {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
  }
  const count = parseInt(req.nextUrl.searchParams.get("count") ?? "") || DEFAULT_BATCH_SIZE;
  return runBackfill(count);
}

async function runBackfill(batchSize: number) {
  if (!client || !writeClient) {
    return NextResponse.json({ error: "Sanity not configured" }, { status: 500 });
  }

  // Fetch articles missing heroImageUrl that have some source image, oldest first
  // so the daily cron works through a backlog in order rather than jumping around.
  const allMissing = await client.fetch<Array<{
    _id: string;
    title: string;
    slug: { current: string };
    ogImage?: string;
    pillar?: { _ref: string };
    featuredImage?: { asset?: { url?: string }; alt?: string };
  }>>(
    `*[_type == "article" && !defined(heroImageUrl) && (defined(ogImage) || defined(featuredImage))] | order(_createdAt asc) {
      _id, title, slug, ogImage,
      pillar { _ref },
      featuredImage { asset { url }, alt }
    }`
  );

  if (allMissing.length === 0) {
    return NextResponse.json({ patched: 0, message: "All articles already have heroImageUrl" });
  }

  const articles = allMissing.slice(0, batchSize);
  const remaining = allMissing.length - articles.length;

  let patched = 0;
  let cloudinaryUploads = 0;
  const skipped: string[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const article of articles) {
    const sourceUrl =
      article.ogImage ??
      article.featuredImage?.asset?.url ??
      null;

    if (!sourceUrl) {
      skipped.push(article._id);
      continue;
    }

    if (!sourceUrl.startsWith("https://")) {
      // Not a real URL (e.g. leftover "[IMAGE placeholder — generation skipped...]"
      // text from content authored without image credentials) — nothing to
      // re-host. Leave heroImageUrl unset so it's still findable for a real fix.
      skipped.push(article._id);
      continue;
    }

    const isAlreadyCloudinary = sourceUrl.startsWith("https://res.cloudinary.com/");

    if (!isAlreadyCloudinary) {
      // Raw source image (Pexels, etc.) — download and push through Cloudinary for
      // responsive variants and so we don't depend on the source host staying
      // reachable or allow-listed in next.config.js image remotePatterns.
      try {
        const buf = await fetchImageBuffer(sourceUrl);
        if (!buf) throw new Error(`Failed to fetch image from ${sourceUrl}`);

        const pillar = article.pillar?._ref ?? "water-cooler";
        const slug = article.slug?.current ?? article._id.replace("article-", "");
        const cdn = await uploadToCloudinary(buf, slug, pillar);

        await writeClient
          .patch(article._id)
          .set({
            heroImageUrl: cdn.heroUrl,
            ogImage:      cdn.ogImageUrl,
            imageGeneratedWith: "pexels",
          })
          .commit();

        cloudinaryUploads++;
        patched++;
        console.log(`[backfill-images] Cloudinary ok: ${article._id}`);
      } catch (err) {
        const msg = (err as Error).message;
        console.error(`[backfill-images] Cloudinary failed for ${article._id}:`, msg);
        errors.push({ id: article._id, error: msg });

        // Best-effort fallback: at least set heroImageUrl to the raw source URL
        try {
          await writeClient
            .patch(article._id)
            .set({ heroImageUrl: sourceUrl })
            .commit();
          patched++;
        } catch { /* ignore */ }
      }

      // Small pause between Cloudinary uploads to avoid rate limits
      await new Promise((r) => setTimeout(r, 300));
    } else {
      // Already a Cloudinary URL — just promote it, no re-upload needed
      try {
        await writeClient
          .patch(article._id)
          .set({
            heroImageUrl: sourceUrl,
            heroImageAlt: article.featuredImage?.alt ?? article.title,
          })
          .commit();
        patched++;
      } catch (err) {
        errors.push({ id: article._id, error: (err as Error).message });
      }
    }
  }

  return NextResponse.json({
    total: articles.length,
    remaining,
    patched,
    cloudinaryUploads,
    skipped: skipped.length,
    errors: errors.length,
    errorDetails: errors,
  });
}
