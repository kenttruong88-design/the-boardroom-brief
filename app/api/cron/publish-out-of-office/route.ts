import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { generateArticleImage } from "@/app/lib/agents/image-generator";
import type { ArticleDraft } from "@/app/lib/agents/types";

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[publish-out-of-office] CRON_SECRET env var is not set");
    return false;
  }
  const bearer = req.headers.get("authorization") ?? "";
  const header = req.headers.get("x-cron-secret") ?? "";
  return bearer === `Bearer ${secret}` || header === secret;
}

const PILLAR_ID   = "out-of-office";
const PILLAR_NAME = "Out of Office";
const AUTHOR_ID   = "author-suki-nakamura";
const AUTHOR_NAME = "Suki Nakamura";
const CONTENT_DIR = "content/out-of-office";

function getSanityClient() {
  return createClient({
    projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "e8dwtkci",
    dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET    ?? "production",
    apiVersion: "2024-01-01",
    useCdn:     false,
    token:      process.env.SANITY_API_TOKEN,
  });
}

let _k = 0;
const key = () => `k${++_k}`;

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96);
}

function parseInline(text: string) {
  const spans: object[] = [];
  const re = /[*][*](.+?)[*][*]|[*](.+?)[*]|([^*]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) spans.push({ _type: "span", _key: key(), text: m[1], marks: ["strong"] });
    else if (m[2]) spans.push({ _type: "span", _key: key(), text: m[2], marks: ["em"] });
    else if (m[3]) spans.push({ _type: "span", _key: key(), text: m[3], marks: [] });
  }
  return spans.length ? spans : [{ _type: "span", _key: key(), text, marks: [] }];
}

function markdownToBlocks(body: string) {
  const blocks: object[] = [];
  for (let para of body.split(/\n{2,}/)) {
    para = para.trim();
    if (!para || para.startsWith("![")) continue;

    // Blockquote (Voice from the Real World sections)
    if (para.startsWith(">")) {
      const text = para.split("\n").map(l => l.replace(/^>\s?/, "").trim()).filter(Boolean).join(" ");
      if (text) blocks.push({ _type: "block", _key: key(), style: "blockquote", markDefs: [], children: parseInline(text) });
      continue;
    }

    const h4 = para.match(/^#{4}\s+(.+)/);
    const h3 = para.match(/^#{3}\s+(.+)/);
    const h2 = para.match(/^#{2}\s+(.+)/);
    if (h4) { blocks.push({ _type: "block", _key: key(), style: "h4", markDefs: [], children: parseInline(h4[1]) }); continue; }
    if (h3) { blocks.push({ _type: "block", _key: key(), style: "h3", markDefs: [], children: parseInline(h3[1]) }); continue; }
    if (h2) { blocks.push({ _type: "block", _key: key(), style: "h2", markDefs: [], children: parseInline(h2[1]) }); continue; }

    // Markdown table — detect Do/Don't columns and split into separate sections
    const lines = para.split("\n");
    if (lines.filter((l: string) => l.includes("|")).length > 1) {
      const tableLines = lines.map((l: string) => l.trim()).filter(Boolean);
      const headerLine = tableLines[0] ?? "";
      const isDosDonts = /do[''s]*/i.test(headerLine) && /don[''t]*/i.test(headerLine);

      if (isDosDonts) {
        const rows: [string, string][] = [];
        for (let i = 2; i < tableLines.length; i++) {
          const t = tableLines[i];
          if (!t || /^[|][-|\s:]+[|]$/.test(t)) continue;
          const cells = t.split("|").map((c: string) => c.trim()).filter(Boolean);
          if (cells.length >= 2) rows.push([cells[0], cells[1]]);
        }
        if (rows.length) {
          blocks.push({ _type: "block", _key: key(), style: "normal", markDefs: [],
            children: [{ _type: "span", _key: key(), text: "✅ Do", marks: ["strong"] }] });
          for (const [doItem] of rows) {
            blocks.push({ _type: "block", _key: key(), style: "normal", listItem: "bullet", level: 1, markDefs: [],
              children: parseInline(doItem) });
          }
          blocks.push({ _type: "block", _key: key(), style: "normal", markDefs: [],
            children: [{ _type: "span", _key: key(), text: "❌ Don't", marks: ["strong"] }] });
          for (const [, dontItem] of rows) {
            if (dontItem) blocks.push({ _type: "block", _key: key(), style: "normal", listItem: "bullet", level: 1, markDefs: [],
              children: parseInline(dontItem) });
          }
        }
      } else {
        for (const line of tableLines) {
          const t = line.trim();
          if (!t || /^[|][-|\s:]+[|]$/.test(t)) continue;
          const cells = t.split("|").map((c: string) => c.trim()).filter(Boolean);
          if (cells.length) blocks.push({ _type: "block", _key: key(), style: "normal", markDefs: [],
            children: parseInline(cells.join("  —  ")) });
        }
      }
      continue;
    }

    const merged = lines.map((l: string) => l.trim()).filter(Boolean).join(" ");
    if (merged && !merged.startsWith("![")) {
      blocks.push({ _type: "block", _key: key(), style: "normal", markDefs: [], children: parseInline(merged) });
    }
  }
  return blocks;
}

function parseFrontmatter(raw: string): Record<string, string | Record<string, string>> {
  const fm: Record<string, string | Record<string, string>> = {};
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length) {
    const nested = lines[i].match(/^(\w+):\s*$/);
    if (nested) {
      const block: Record<string, string> = {};
      i++;
      while (i < lines.length && /^\s{2}/.test(lines[i])) {
        const kv = lines[i].trim().match(/^(\w+):\s*(.*)/);
        if (kv) block[kv[1]] = kv[2].trim();
        i++;
      }
      fm[nested[1]] = block;
      continue;
    }
    const kv = lines[i].match(/^(\w[\w_]*):\s*(.*)/);
    if (kv) fm[kv[1]] = kv[2].trim();
    i++;
  }
  return fm;
}

interface Article {
  title: string; slug: string; excerpt: string;
  heroUrl: string; ogUrl: string; pubDt: string;
  readTime: number; blocks: object[]; seoDesc: string;
  countries: string[]; subject: string;
}

// Content is normally authored with an H1 title (`# Title`). Some generated
// batches instead emit the title as a standalone bold line (`**Title**`) with
// no H1 — fall back to that before ever falling back to the raw filename.
function extractTitle(bodyMd: string, filePath: string): { title: string; noTitle: string } {
  const h1 = bodyMd.match(/^#\s+(.+)$/m);
  if (h1) {
    return { title: h1[1].trim(), noTitle: bodyMd.replace(/^#\s+.+\n*/m, "").trim() };
  }

  const lines = bodyMd.split("\n");
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  const firstLine = firstIdx >= 0 ? lines[firstIdx].trim() : "";
  const bold = firstLine.match(/^\*\*(.+?)\*\*$/);
  if (bold) {
    const rest = [...lines.slice(0, firstIdx), ...lines.slice(firstIdx + 1)].join("\n");
    return { title: bold[1].trim(), noTitle: rest.trim() };
  }

  const fallback = filePath.split(/[/\\]/).pop()!.replace(/\.md$/i, "").replace(/-/g, " ");
  return { title: fallback, noTitle: bodyMd };
}

// Country-flag emoji are pairs of Unicode regional indicator symbols
// (U+1F1E6–U+1F1FF). The template always opens the body with a flag line
// ("🇵🇱 Poland 🇿🇦 South Africa") and a byline ("*By ..., Out of Office*")
// before the real teaser paragraph — skip both so the excerpt is actual copy.
const REGIONAL_INDICATOR = /^[\u{1F1E6}-\u{1F1FF}]/u;

function extractExcerpt(noTitle: string): string {
  for (const para of noTitle.split(/\n{2,}/)) {
    const stripped = para.trim().replace(/^\*\*(.+)\*\*$/, "$1").replace(/^\*(.+)\*$/, "$1").trim();
    if (!stripped) continue;
    if (/^-{3,}$/.test(stripped)) continue;
    if (REGIONAL_INDICATOR.test(stripped)) continue;
    if (/^By\s+/i.test(stripped)) continue;
    return stripped
      .replace(/[*][*](.+?)[*][*]/g, "$1").replace(/[*](.+?)[*]/g, "$1")
      .replace(/!\[.*?\]\(.*?\)/g, "").replace(/^#+\s+/, "").trim().slice(0, 300);
  }
  return "";
}

function parseArticle(filePath: string): Article | null {
  const text  = readFileSync(filePath, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const fm      = parseFrontmatter(match[1]);
  const bodyMd  = match[2].trim();
  const { title, noTitle } = extractTitle(bodyMd, filePath);
  const excerpt = extractExcerpt(noTitle);
  const images  = (fm.images ?? {}) as Record<string, string>;
  const heroUrl = images.hero ?? "";
  const ogUrl   = images.body ?? heroUrl;
  const dateStr = (fm.date ?? new Date().toISOString().split("T")[0]) as string;
  const pubDt   = new Date(`${dateStr}T08:00:00Z`).toISOString();
  const wordCount = parseInt(fm.word_count as string) || bodyMd.split(/\s+/).length;
  const readTime  = Math.max(1, Math.round(wordCount / 200));
  const slug      = slugify(title);
  const blocks    = markdownToBlocks(noTitle);
  const seoDesc   = `${title}. By ${AUTHOR_NAME} for The Alignment Times.`.slice(0, 160);
  const countries = ((fm.countries as string) ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const subject   = (fm.subject as string) ?? "";
  return { title, slug, excerpt, heroUrl, ogUrl, pubDt, readTime, blocks, seoDesc, countries, subject };
}

async function ensurePillar(client: ReturnType<typeof getSanityClient>) {
  await client.createIfNotExists({ _id: PILLAR_ID, _type: "pillar",
    name: PILLAR_NAME, slug: { _type: "slug", current: PILLAR_ID } });
}

async function ensureAuthor(client: ReturnType<typeof getSanityClient>) {
  await client.createIfNotExists({ _id: AUTHOR_ID, _type: "author",
    name: AUTHOR_NAME, slug: { _type: "slug", current: "suki-nakamura" },
    bio: "Relocated 14 times. Has eaten in 60 countries. Covers food, cities, and life outside the desk." });
}


// Pexels page URLs end in a numeric photo ID, e.g. .../photo/some-slug-1234567/
function extractPexelsPhotoId(pexelsPageUrl: string): string | null {
  const m = pexelsPageUrl.match(/-(\d+)\/?$/);
  return m ? m[1] : null;
}

async function publishArticle(
  client: ReturnType<typeof getSanityClient>,
  article: Article,
  usedPexelsIds: Set<string>
): Promise<string> {
  const docId = `article-ooo-${article.slug}`;

  // Same image line as the newsroom pillars (see app/lib/agents/image-generator.ts):
  // 1. Flux Schnell via Replicate (AI-generated, prompt written from the article)
  // 2. Pexels API search fallback
  // 3. Pillar default image
  // All variants served through Cloudinary. The frontmatter Pexels URL is only
  // used if the entire pipeline throws unexpectedly.
  let heroImageUrl = article.heroUrl || article.ogUrl;
  let ogImage      = article.ogUrl || article.heroUrl;
  let imageGeneratedWith = "pexels";
  let imagePrompt: string | null = null;
  let imagePhotographerName: string | null = null;
  let imagePhotographerUrl: string | null = null;
  let imagePexelsUrl: string | null = null;
  try {
    const draft = {
      pillar:    PILLAR_ID,
      agentName: AUTHOR_NAME,
      headline:  article.title,
      body:      article.excerpt,
      tags:      [article.subject, ...article.countries].filter(Boolean),
      countries: article.countries,
      satiricalHeadline: "", seoTitle: "", seoDescription: "",
      tone: "straight", marketSymbols: [], topicBrief: {},
    } as unknown as ArticleDraft;
    const img = await generateArticleImage(draft, usedPexelsIds);
    heroImageUrl          = img.heroUrl;
    ogImage               = img.ogImageUrl;
    imageGeneratedWith    = img.source;
    imagePrompt           = null;
    imagePhotographerName = img.photographerName ?? null;
    imagePhotographerUrl  = img.photographerUrl ?? null;
    imagePexelsUrl        = img.pexelsPageUrl ?? null;
    if (imagePexelsUrl) {
      const id = extractPexelsPhotoId(imagePexelsUrl);
      if (id) usedPexelsIds.add(id);
    }
    console.log(`[publish-out-of-office] Image via ${img.source}: ${img.publicId}`);
  } catch (err) {
    console.warn("[publish-out-of-office] Image pipeline failed, using frontmatter URL:", (err as Error).message);
  }

  await client.createOrReplace({
    _id: docId, _type: "article",
    title: article.title,
    slug: { _type: "slug", current: article.slug },
    excerpt: article.excerpt,
    body: article.blocks,
    pillar: { _type: "reference", _ref: PILLAR_ID },
    author: { _type: "reference", _ref: AUTHOR_ID },
    publishedAt: article.pubDt,
    readTime: article.readTime,
    featured: false,
    aiGenerated: false,
    agentName: AUTHOR_NAME,
    heroImageUrl,
    heroImageAlt: article.title,
    ogImage,
    imageGeneratedWith,
    imagePrompt,
    imagePhotographerName,
    imagePhotographerUrl,
    imagePexelsUrl,
    seoDescription: article.seoDesc,
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.thealignmenttimes.com";
  try {
    const res = await fetch(`${siteUrl}/api/revalidate?secret=${process.env.SANITY_WEBHOOK_SECRET ?? ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _type: "article", slug: { current: article.slug }, pillarSlug: PILLAR_ID }),
    });
    if (!res.ok) console.warn(`[publish-out-of-office] Revalidate returned ${res.status} for ${article.slug}`);
  } catch (err) {
    console.warn(`[publish-out-of-office] Revalidate fetch failed for ${article.slug}:`, err);
  }
  return `${siteUrl}/out-of-office/${article.slug}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const COUNT = parseInt(req.nextUrl.searchParams.get("count") ?? "4");
  try {
    const client = getSanityClient();
    const existing: { slug: { current: string }; imagePexelsUrl?: string }[] = await client.fetch(
      `*[_type == "article" && pillar._ref == "${PILLAR_ID}"]{ slug, imagePexelsUrl }`
    );
    const publishedSlugs = new Set(existing.map(d => d.slug.current));

    // Already-used Pexels photo IDs for this pillar — passed into the image
    // pipeline so we don't keep re-picking the same stock photos across
    // separate cron runs (the in-process dedup in image-generator.ts only
    // covers photos used within a single invocation).
    const usedPexelsIds = new Set<string>();
    for (const doc of existing) {
      const id = doc.imagePexelsUrl ? extractPexelsPhotoId(doc.imagePexelsUrl) : null;
      if (id) usedPexelsIds.add(id);
    }
    const contentDir = join(process.cwd(), CONTENT_DIR);
    const allFiles = readdirSync(contentDir).filter(f => f.endsWith(".md")).sort();
    const candidates: { filename: string; article: Article }[] = [];
    for (const filename of allFiles) {
      const article = parseArticle(join(contentDir, filename));
      if (!article) continue;
      if (!publishedSlugs.has(article.slug)) candidates.push({ filename, article });
    }
    if (!candidates.length) {
      return NextResponse.json({ message: "All out-of-office articles already published", published: 0 });
    }
    const toPublish = candidates.slice(0, COUNT);
    await ensurePillar(client);
    await ensureAuthor(client);
    const results: { title: string; url: string }[] = [];
    const failures: { filename: string; error: string }[] = [];
    for (const { filename, article } of toPublish) {
      try {
        const url = await publishArticle(client, article, usedPexelsIds);
        results.push({ title: article.title, url });
        console.log(`[publish-out-of-office] Published: ${article.title}`);
      } catch (err) {
        console.error(`[publish-out-of-office] Failed to publish ${filename}:`, err);
        failures.push({ filename, error: (err as Error).message });
      }
    }
    return NextResponse.json({
      published: results.length,
      failed: failures.length,
      remaining: candidates.length - results.length,
      articles: results,
      ...(failures.length ? { failures } : {}),
    });
  } catch (err) {
    console.error("[publish-out-of-office]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
