import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

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
    if (!para || /^!\[/.test(para)) continue;
    const h3 = para.match(/^###\s+(.+)/);
    const h2 = para.match(/^##\s+(.+)/);
    if (h3) { blocks.push({ _type: "block", _key: key(), style: "h3", markDefs: [], children: parseInline(h3[1]) }); continue; }
    if (h2) { blocks.push({ _type: "block", _key: key(), style: "h2", markDefs: [], children: parseInline(h2[1]) }); continue; }
    const merged = para.split("\n").map((l: string) => l.trim()).filter(Boolean).join(" ");
    if (!merged || /^!\[/.test(merged)) continue;
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
  const seoDesc   = `${cStr}: ${subject}. Analysis by Priya Mehta for The Alignment Times.`.slice(0, 160);

  return { title, slug, excerpt, subject, countries, heroUrl, ogUrl, pubDt, readTime, blocks, seoDesc };
}

async function ensurePillar(client: ReturnType<typeof getSanityClient>) {
  await client.createIfNotExists({ _id: "global-office", _type: "pillar",
    name: "The Global Office", slug: { _type: "slug", current: "global-office" } });
}

async function ensureAuthor(client: ReturnType<typeof getSanityClient>) {
  await client.createIfNotExists({ _id: "author-priya-mehta", _type: "author",
    name: "Priya Mehta", slug: { _type: "slug", current: "priya-mehta" },
    bio: "Staff writer for The Alignment Times covering global work and life culture." });
}

async function ensureCountries(client: ReturnType<typeof getSanityClient>, countries: string[]) {
  await Promise.all(countries.map((c) => {
    const cid = "country-" + slugify(c);
    return client.createIfNotExists({ _id: cid, _type: "country",
      name: c, slug: { _type: "slug", current: cid.replace("country-", "") } });
  }));
}

async function publishArticle(client: ReturnType<typeof getSanityClient>, article: Article): Promise<string> {
  const docId = `article-${article.slug}`;
  const countryRefs = article.countries.map(c => ({
    _type: "reference", _ref: "country-" + slugify(c), _key: key(),
  }));
  await client.createOrReplace({
    _id: docId, _type: "article",
    title:       article.title,
    slug:        { _type: "slug", current: article.slug },
    excerpt:     article.excerpt,
    body:        article.blocks,
    pillar:      { _type: "reference", _ref: "global-office" },
    author:      { _type: "reference", _ref: "author-priya-mehta" },
    countries:   countryRefs,
    publishedAt: article.pubDt,
    readTime:    article.readTime,
    featured:    false,
    aiGenerated: true,
    agentName:   "Priya Mehta",
    ogImage:     article.ogUrl || article.heroUrl,
    imageGeneratedWith: "pexels",
    seoDescription: article.seoDesc,
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealignmenttimes.com";
  try {
    await fetch(`${siteUrl}/api/revalidate?secret=${process.env.REVALIDATE_SECRET ?? ""}&path=/global-office`, { method: "POST" });
  } catch { /* non-fatal */ }
  return `${siteUrl}/global-office/${article.slug}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const COUNT = Math.min(parseInt(req.nextUrl.searchParams.get("count") ?? "2") || 2, 10);

  try {
    const client = getSanityClient();

    // Query Sanity for already-published Global Office slugs (no local tracking file needed)
    const existing: { slug: { current: string } }[] = await client.fetch(
      `*[_type == "article" && pillar._ref == "global-office"]{ slug }`
    );
    const publishedSlugs = new Set(existing.map(d => d.slug.current));

    // Read .md files from content/global-office/
    const contentDir = join(process.cwd(), "content", "global-office");
    const allFiles   = readdirSync(contentDir).filter(f => f.endsWith(".md")).sort();

    // Find unpublished: parse slug from file, check against Sanity
    const candidates: { filename: string; article: Article }[] = [];
    for (const filename of allFiles) {
      const article = parseArticle(join(contentDir, filename));
      if (!article) continue;
      if (!publishedSlugs.has(article.slug)) {
        candidates.push({ filename, article });
      }
    }

    if (!candidates.length) {
      return NextResponse.json({ message: "All articles already published", published: 0 });
    }

    const toPublish = candidates.slice(0, COUNT);
    console.log(`[publish-articles] ${candidates.length} unpublished. Publishing ${toPublish.length}.`);

    await ensurePillar(client);
    await ensureAuthor(client);

    const results: { title: string; url: string }[] = [];
    for (const { article } of toPublish) {
      await ensureCountries(client, article.countries);
      const url = await publishArticle(client, article);
      results.push({ title: article.title, url });
      console.log(`[publish-articles] Published: ${article.title}`);
    }

    return NextResponse.json({
      published:  results.length,
      remaining:  candidates.length - results.length,
      articles:   results,
    });
  } catch (err) {
    console.error("[publish-articles]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
