import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { uploadToCloudinary } from "@/app/lib/agents/image-generator";

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
}

function parseArticle(filePath: string): Article | null {
  const text  = readFileSync(filePath, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const fm      = parseFrontmatter(match[1]);
  const bodyMd  = match[2].trim();
  const titleM  = bodyMd.match(/^#\s+(.+)$/m);
  const title   = titleM ? titleM[1].trim() : filePath.split("/").pop()!.replace(/-/g, " ");
  const noTitle = bodyMd.replace(/^#\s+.+\n*/m, "").trim();
  const excerpt = (noTitle.split(/\n{2,}/)[0] ?? "")
    .replace(/[*][*](.+?)[*][*]/g, "$1").replace(/[*](.+?)[*]/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, "").replace(/^#+\s+/, "").trim().slice(0, 300);
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
  return { title, slug, excerpt, heroUrl, ogUrl, pubDt, readTime, blocks, seoDesc };
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


async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function publishArticle(client: ReturnType<typeof getSanityClient>, article: Article): Promise<string> {
  const docId = `article-ooo-${article.slug}`;

  // Same image pipeline as publish-articles: pull the Pexels source through
  // Cloudinary for responsive variants; fall back to the raw URL on failure.
  let heroImageUrl = article.heroUrl || article.ogUrl;
  let ogImage      = article.ogUrl || article.heroUrl;
  if (heroImageUrl) {
    try {
      const buf = await fetchImageBuffer(heroImageUrl);
      if (buf) {
        const cdn = await uploadToCloudinary(buf, article.slug, PILLAR_ID);
        heroImageUrl = cdn.heroUrl;
        ogImage      = cdn.ogImageUrl;
        console.log(`[publish-out-of-office] Cloudinary upload ok: ${cdn.publicId}`);
      }
    } catch (err) {
      console.warn("[publish-out-of-office] Cloudinary upload failed, using raw URL:", (err as Error).message);
    }
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
    imageGeneratedWith: "pexels",
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
    const existing: { slug: { current: string } }[] = await client.fetch(
      `*[_type == "article" && pillar._ref == "${PILLAR_ID}"]{ slug }`
    );
    const publishedSlugs = new Set(existing.map(d => d.slug.current));
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
        const url = await publishArticle(client, article);
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
