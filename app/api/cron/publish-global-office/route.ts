import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "boardroom-cron";
  const bearer = req.headers.get("authorization") ?? "";
  const header = req.headers.get("x-cron-secret") ?? "";
  return bearer === `Bearer ${secret}` || header === secret;
}

// ── Config ────────────────────────────────────────────────────────────────────

const PILLAR_ID   = "global-office";
const PILLAR_NAME = "Global Office";
const AUTHOR_ID   = "author-priya-mehta";
const AUTHOR_NAME = "Priya Mehta";
const CONTENT_DIR = "content/global-office";

// ── Sanity client ─────────────────────────────────────────────────────────────

function getSanityClient() {
  return createClient({
    projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "e8dwtkci",
    dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET    ?? "production",
    apiVersion: "2024-01-01",
    useCdn:     false,
    token:      process.env.SANITY_API_TOKEN,
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
    if (!para) continue;

    // Horizontal rules — skip
    if (/^-{3,}$/.test(para)) continue;

    // Images and captions — skip
    if (/^!\[/.test(para)) continue;
    if (/^\*(?:Photo|Illustration):/.test(para)) continue;

    // H4
    const h4 = para.match(/^####\s+(.+)/);
    if (h4) { blocks.push({ _type: "block", _key: key(), style: "h4", markDefs: [], children: parseInline(h4[1]) }); continue; }

    // H3
    const h3 = para.match(/^###\s+(.+)/);
    if (h3) { blocks.push({ _type: "block", _key: key(), style: "h3", markDefs: [], children: parseInline(h3[1]) }); continue; }

    // H2
    const h2 = para.match(/^##\s+(.+)/);
    if (h2) { blocks.push({ _type: "block", _key: key(), style: "h2", markDefs: [], children: parseInline(h2[1]) }); continue; }

    // Markdown table — convert each data row to two bullet points (Do / Don't)
    if (/^\|/.test(para)) {
      const rows = para.split("\n").map(l => l.trim()).filter(l => l.startsWith("|"));
      for (const row of rows) {
        if (/^\|[\s\-:|]+\|/.test(row)) continue; // separator row
        const cells = row.split("|").map(c => c.trim()).filter(Boolean);
        if (cells.length < 1) continue;
        const isHeader = cells.some(c => /✅|❌|Do$|Don't/.test(c));
        if (isHeader) continue;
        for (const cell of cells) {
          const text = cell.replace(/<[^>]+>/g, "").trim();
          if (!text) continue;
          blocks.push({ _type: "block", _key: key(), style: "normal", listItem: "bullet", level: 1, markDefs: [], children: parseInline(text) });
        }
      }
      continue;
    }

    // Blockquotes (> lines) and <small> quote blocks
    if (/^>/.test(para) || /<small>/.test(para)) {
      const text = para
        .split("\n")
        .map(l => l.replace(/^>\s*/, "").replace(/<\/?small>/g, "").replace(/^\*\s*/, "").trim())
        .filter(Boolean)
        .join(" ")
        .trim();
      if (text) blocks.push({ _type: "block", _key: key(), style: "blockquote", markDefs: [], children: parseInline(text) });
      continue;
    }

    // Regular paragraph — filter out image lines and captions within mixed paras
    const textLines = para.split("\n")
      .map(l => l.trim())
      .filter(l => l && !/^!\[/.test(l) && !/^\*(?:Photo|Illustration):/.test(l));
    if (!textLines.length) continue;
    const merged = textLines.join(" ");
    if (merged) blocks.push({ _type: "block", _key: key(), style: "normal", markDefs: [], children: parseInline(merged) });
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
    .replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1")
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
  const seoDesc   = `${title}. By ${AUTHOR_NAME} for The Boardroom Brief.`.slice(0, 160);

  return { title, slug, excerpt, heroUrl, ogUrl, pubDt, readTime, blocks, seoDesc };
}

async function ensurePillar(client: ReturnType<typeof getSanityClient>) {
  await client.createIfNotExists({ _id: PILLAR_ID, _type: "pillar",
    name: PILLAR_NAME, slug: { _type: "slug", current: PILLAR_ID } });
}

async function ensureAuthor(client: ReturnType<typeof getSanityClient>) {
  await client.createIfNotExists({ _id: AUTHOR_ID, _type: "author",
    name: AUTHOR_NAME, slug: { _type: "slug", current: "priya-mehta" },
    bio: "Staff writer for The Boardroom Brief covering global workplace culture and cross-cultural professional norms." });
}

async function publishArticle(client: ReturnType<typeof getSanityClient>, article: Article): Promise<string> {
  const docId = `article-go-${article.slug}`;
  await client.createOrReplace({
    _id: docId, _type: "article",
    title:       article.title,
    slug:        { _type: "slug", current: article.slug },
    excerpt:     article.excerpt,
    body:        article.blocks,
    pillar:      { _type: "reference", _ref: PILLAR_ID },
    author:      { _type: "reference", _ref: AUTHOR_ID },
    publishedAt: article.pubDt,
    readTime:    article.readTime,
    featured:    false,
    aiGenerated: false,
    agentName:   AUTHOR_NAME,
    ogImage:     article.ogUrl || article.heroUrl,
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
  return `${siteUrl}/global-office/${article.slug}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const COUNT = parseInt(req.nextUrl.searchParams.get("count") ?? "4");

  try {
    const client = getSanityClient();

    const existing: { slug: { current: string } }[] = await client.fetch(
      `*[_type == "article" && pillar._ref == "${PILLAR_ID}" && _id match "article-go-*"]{ slug }`
    );
    const publishedSlugs = new Set(existing.map(d => d.slug.current));

    const contentDir = join(process.cwd(), CONTENT_DIR);
    const allFiles   = readdirSync(contentDir).filter(f => f.endsWith(".md")).sort();

    const candidates: { filename: string; article: Article }[] = [];
    for (const filename of allFiles) {
      const article = parseArticle(join(contentDir, filename));
      if (!article) continue;
      if (!publishedSlugs.has(article.slug)) {
        candidates.push({ filename, article });
      }
    }

    if (!candidates.length) {
      return NextResponse.json({ message: "All Global Office articles already published", published: 0 });
    }

    const toPublish = candidates.slice(0, COUNT);
    console.log(`[publish-global-office] ${candidates.length} unpublished. Publishing ${toPublish.length}.`);

    await ensurePillar(client);
    await ensureAuthor(client);

    const results: { title: string; url: string }[] = [];
    for (const { article } of toPublish) {
      const url = await publishArticle(client, article);
      results.push({ title: article.title, url });
      console.log(`[publish-global-office] Published: ${article.title}`);
    }

    return NextResponse.json({
      published: results.length,
      remaining: candidates.length - results.length,
      articles:  results,
    });
  } catch (err) {
    console.error("[publish-global-office]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
