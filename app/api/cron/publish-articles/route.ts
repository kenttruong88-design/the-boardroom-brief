import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { uploadToCloudinary } from "@/app/lib/agents/image-generator";

// ── Pillar configs ────────────────────────────────────────────────────────────

interface PillarConfig {
  id: string;
  name: string;
  contentDir: string;
  authorId: string;
  authorName: string;
  authorSlug: string;
  authorBio: string;
}

const PILLAR_CONFIGS: PillarConfig[] = [
  {
    id: "global-office",
    name: "The Global Office",
    contentDir: "global-office",
    authorId: "author-priya-mehta",
    authorName: "Priya Mehta",
    authorSlug: "priya-mehta",
    authorBio: "Staff writer for The Alignment Times covering global work and life culture.",
  },
  {
    id: "out-of-office",
    name: "Out of Office",
    contentDir: "out-of-office",
    authorId: "author-suki-nakamura",
    authorName: "Suki Nakamura",
    authorSlug: "suki-nakamura",
    authorBio: "Relocated 14 times. Has eaten in 60 countries. Will tell you exactly which cities deserve to exist and why your favourite restaurant is completely wrong.",
  },
];

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[publish-articles] CRON_SECRET env var is not set");
    return false;
  }
  const bearer = req.headers.get("authorization") ?? "";
  const header = req.headers.get("x-cron-secret") ?? "";
  return bearer === `Bearer ${secret}` || header === secret;
}

// ── Sanity client ─────────────────────────────────────────────────────────────

function getSanityClient() {
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "e8dwtkci",
    dataset:   process.env.NEXT_PUBLIC_SANITY_DATASET    ?? "production",
    apiVersion: "2024-01-01",
    useCdn:    false,
    token:     process.env.SANITY_API_TOKEN,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _k = 0;
const key = () => `k${++_k}`;

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96);
}

function parseInline(text: string) {
  const spans: object[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|([^*]+)/g;
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
    if (!para || /^\!\[/.test(para)) continue;

    // Headings
    const h4 = para.match(/^####\s+(.+)/);
    const h3 = para.match(/^###\s+(.+)/);
    const h2 = para.match(/^##\s+(.+)/);
    if (h4) { blocks.push({ _type: "block", _key: key(), style: "h3", markDefs: [], children: parseInline(h4[1]) }); continue; }
    if (h3) { blocks.push({ _type: "block", _key: key(), style: "h3", markDefs: [], children: parseInline(h3[1]) }); continue; }
    if (h2) { blocks.push({ _type: "block", _key: key(), style: "h2", markDefs: [], children: parseInline(h2[1]) }); continue; }

    // Markdown table: multiple lines with pipe characters
    const lines = para.split("\n");
    const tableLines = lines.filter((l: string) => l.includes("|"));
    if (tableLines.length > 1) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/^\|[-|\s:]+\|$/.test(trimmed)) continue; // skip |---|---| rows
        const cells = trimmed.split("|").map((c: string) => c.trim()).filter(Boolean);
        if (cells.length === 0) continue;
        const text = cells.join("  |  ");
        if (text.trim()) blocks.push({ _type: "block", _key: key(), style: "normal", markDefs: [], children: parseInline(text) });
      }
      continue;
    }

    // Normal paragraph
    const merged = para.split("\n").map((l: string) => l.trim()).filter(Boolean).join(" ");
    if (!merged || /^\!\[/.test(merged)) continue;
    blocks.push({ _type: "block", _key: key(), style: "normal", markDefs: [], children: parseInline(merged) });
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
  title: string; slug: string; excerpt: string; subject: string;
  countries: string[]; heroUrl: string; ogUrl: string; pubDt: string;
  readTime: number; blocks: object[]; seoDesc: string;
}

function parseArticle(filePath: string, config: PillarConfig): Article | null {
  const text  = readFileSync(filePath, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const fm      = parseFrontmatter(match[1]);
  const bodyMd  = match[2].trim();
  const titleM  = bodyMd.match(/^#\s+(.+)$/m);
  const title   = titleM ? titleM[1].trim() : filePath.split("/").pop()!.replace(/-/g, " ");
  const noTitle = bodyMd.replace(/^#\s+.+\n*/m, "").trim();
  const excerpt = (noTitle.split(/\n{2,}/)[0] ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, "").replace(/^#+\s+/, "").trim().slice(0, 300);

  const images  = (fm.images ?? {}) as Record<string, string>;
  const heroUrl = images.hero ?? "";
  const ogUrl   = images.body ?? heroUrl;

  const countriesRaw = (fm.countries ?? "") as string;
  const countries    = countriesRaw.split(",").map((c: string) => c.trim()).filter(Boolean);

  const dateStr = (fm.date ?? new Date().toISOString().split("T")[0]) as string;
  const pubDt   = new Date(`${dateStr}T08:00:00Z`).toISOString();

  const wordCount = parseInt(fm.word_count as string) || bodyMd.split(/\s+/).length;
  const readTime  = Math.max(1, Math.round(wordCount / 200));
  const slug      = slugify(title);
  const blocks    = markdownToBlocks(noTitle);
  const cStr      = countries.slice(0, 2).join(" vs ");
  const subject   = (fm.subject ?? "") as string;
  const seoDesc   = `${cStr}: ${subject}. By ${config.authorName} for The Alignment Times.`.slice(0, 160);

  return { title, slug, excerpt, subject, countries, heroUrl, ogUrl, pubDt, readTime, blocks, seoDesc };
}

async function ensurePillar(client: ReturnType<typeof getSanityClient>, config: PillarConfig) {
  await client.createIfNotExists({
    _id: config.id,
    _type: "pillar",
    name: config.name,
    slug: { _type: "slug", current: config.id },
  });
}

async function ensureAuthor(client: ReturnType<typeof getSanityClient>, config: PillarConfig) {
  await client.createIfNotExists({
    _id: config.authorId,
    _type: "author",
    name: config.authorName,
    slug: { _type: "slug", current: config.authorSlug },
    bio: config.authorBio,
  });
}

async function ensureCountries(client: ReturnType<typeof getSanityClient>, countries: string[]) {
  await Promise.all(countries.map((c) => {
    const cid = "country-" + slugify(c);
    return client.createIfNotExists({ _id: cid, _type: "country",
      name: c, slug: { _type: "slug", current: cid.replace("country-", "") } });
  }));
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

async function publishArticle(
  client: ReturnType<typeof getSanityClient>,
  article: Article,
  config: PillarConfig
): Promise<string> {
  const docId = `article-${article.slug}`;
  const countryRefs = article.countries.map(c => ({
    _type: "reference", _ref: "country-" + slugify(c), _key: key(),
  }));

  let heroImageUrl = article.heroUrl;
  let ogImage      = article.ogUrl || article.heroUrl;
  if (article.heroUrl) {
    try {
      const buf = await fetchImageBuffer(article.heroUrl);
      if (buf) {
        const cdn = await uploadToCloudinary(buf, article.slug, config.id);
        heroImageUrl = cdn.heroUrl;
        ogImage      = cdn.ogImageUrl;
        console.log(`[publish-articles] Cloudinary upload ok: ${cdn.publicId}`);
      }
    } catch (err) {
      console.warn("[publish-articles] Cloudinary upload failed, using raw URL:", (err as Error).message);
    }
  }

  await client.createOrReplace({
    _id: docId, _type: "article",
    title:       article.title,
    slug:        { _type: "slug", current: article.slug },
    excerpt:     article.excerpt,
    body:        article.blocks,
    pillar:      { _type: "reference", _ref: config.id },
    author:      { _type: "reference", _ref: config.authorId },
    countries:   countryRefs,
    publishedAt: article.pubDt,
    readTime:    article.readTime,
    featured:    false,
    aiGenerated: true,
    agentName:   config.authorName,
    heroImageUrl,
    ogImage,
    imageGeneratedWith: "pexels",
    seoDescription: article.seoDesc,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealignmenttimes.com";
  try {
    await fetch(`${siteUrl}/api/revalidate?secret=${process.env.SANITY_WEBHOOK_SECRET ?? ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _type: "article", slug: { current: article.slug } }),
    });
  } catch { /* non-fatal */ }

  return `${siteUrl}/${config.id}/${article.slug}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const COUNT = Math.min(parseInt(req.nextUrl.searchParams.get("count") ?? "4") || 4, 10);

  try {
    const sanity = getSanityClient();
    const allResults: { pillar: string; published: number; remaining: number; articles: { title: string; url: string }[] }[] = [];

    for (const config of PILLAR_CONFIGS) {
      // Query Sanity for already-published slugs for this pillar
      const existing: { slug: { current: string } }[] = await sanity.fetch(
        `*[_type == "article" && pillar._ref == $pillarId]{ slug }`,
        { pillarId: config.id }
      );
      const publishedSlugs = new Set(existing.map(d => d.slug.current));

      // Read .md files from the content directory
      const contentDir = join(process.cwd(), "content", config.contentDir);
      let allFiles: string[] = [];
      try {
        allFiles = readdirSync(contentDir).filter(f => f.endsWith(".md")).sort();
      } catch {
        // Directory doesn't exist yet — skip this pillar silently
        console.log(`[publish-articles] No content dir for ${config.id}, skipping.`);
        continue;
      }

      const candidates: { filename: string; article: Article }[] = [];
      for (const filename of allFiles) {
        const article = parseArticle(join(contentDir, filename), config);
        if (!article) continue;
        if (!publishedSlugs.has(article.slug)) {
          candidates.push({ filename, article });
        }
      }

      if (!candidates.length) {
        console.log(`[publish-articles] ${config.id}: all articles already published.`);
        allResults.push({ pillar: config.id, published: 0, remaining: 0, articles: [] });
        continue;
      }

      const toPublish = candidates.slice(0, COUNT);
      console.log(`[publish-articles] ${config.id}: ${candidates.length} unpublished, publishing ${toPublish.length}.`);

      await ensurePillar(sanity, config);
      await ensureAuthor(sanity, config);

      const results: { title: string; url: string }[] = [];
      for (const { article } of toPublish) {
        await ensureCountries(sanity, article.countries);
        const url = await publishArticle(sanity, article, config);
        results.push({ title: article.title, url });
        console.log(`[publish-articles] Published: ${article.title}`);
      }

      allResults.push({
        pillar: config.id,
        published: results.length,
        remaining: candidates.length - results.length,
        articles: results,
      });
    }

    return NextResponse.json({ pillars: allResults });
  } catch (err) {
    console.error("[publish-articles]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
