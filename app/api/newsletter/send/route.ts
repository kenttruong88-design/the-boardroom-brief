import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { createAdminClient } from "@/app/lib/supabase";
import { client as sanityClient } from "@/app/lib/sanity";
import MorningBrief, { type MarketItem, type ArticleItem } from "@/emails/morning-brief";

const BATCH_SIZE = 100;

function isAuthorized(req: Request): boolean {
  const secret = req.headers.get("x-newsletter-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

// Vercel Cron hits GET
export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runSend();
}

async function runSend() {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const resend = new Resend(resendKey);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://theboardroombrief.com";

  // ── 1. Fetch confirmed subscribers ──────────────────────────────────────────
  const { data: subscribers, error: subError } = await supabase
    .from("subscribers")
    .select("email")
    .eq("confirmed", true)
    .is("unsubscribed_at", null);

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  const emails = (subscribers ?? []).map((s: { email: string }) => s.email);

  // ── 2. Fetch articles from Sanity (last 24h, fallback to 48h) ──────────────
  let articles: ArticleItem[] = [];
  if (sanityClient) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const query = (since: string) => `
      *[_type == "article" && publishedAt > "${since}"] | order(featured desc, publishedAt desc) [0...4] {
        _id,
        title,
        slug,
        satiricalHeadline,
        excerpt,
        pillar->{ name, slug }
      }
    `;

    let raw = await sanityClient.fetch(query(since24h));
    if (raw.length < 2) {
      raw = await sanityClient.fetch(query(since48h));
    }

    articles = raw.map((a: {
      _id: string; title: string; slug: { current: string };
      satiricalHeadline?: string; excerpt?: string;
      pillar?: { name: string; slug: { current: string } };
    }) => ({
      title: a.title,
      satiricalHeadline: a.satiricalHeadline ?? "",
      excerpt: a.excerpt ?? "",
      pillar: a.pillar?.name ?? "The Boardroom Brief",
      pillarSlug: a.pillar?.slug?.current ?? "markets-floor",
      slug: a.slug.current,
    }));
  }

  // Fallback article if Sanity is empty
  if (articles.length === 0) {
    articles = [{
      title: "The Boardroom Brief — Today's Edition",
      satiricalHeadline: "Five stories. Zero jargon. Probably.",
      excerpt: "Visit the site for today's full coverage.",
      pillar: "The Boardroom Brief",
      pillarSlug: "markets-floor",
      slug: "",
    }];
  }

  // ── 3. Fetch market data from market_cache ───────────────────────────────
  const markets: MarketItem[] = [];
  try {
    const { data: cacheRows } = await supabase
      .from("market_cache")
      .select("symbol, name, price, change_pct")
      .in("symbol", ["SPY", "DAX", "ISF", "EWJ", "C:XAUUSD", "X:BTCUSD"])
      .order("pulled_at", { ascending: false });

    if (cacheRows && cacheRows.length > 0) {
      const seen = new Set<string>();
      for (const row of cacheRows as { symbol: string; name: string; price: number; change_pct: number }[]) {
        if (seen.has(row.symbol)) continue;
        seen.add(row.symbol);
        markets.push({
          symbol: row.symbol.replace("C:", "").replace("X:", ""),
          name: row.name,
          price: row.price.toLocaleString("en-US", { maximumFractionDigits: 2 }),
          changePct: `${row.change_pct >= 0 ? "+" : ""}${row.change_pct.toFixed(2)}%`,
          up: row.change_pct >= 0,
        });
      }
    }
  } catch { /* use template defaults */ }

  // ── 4. Render email template ────────────────────────────────────────────────
  const [leadArticle, ...rest] = articles;
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const html = await render(
    MorningBrief({
      date,
      markets: markets.length > 0 ? markets : undefined,
      leadArticle,
      articles: rest,
      unsubscribeUrl: `${siteUrl}/unsubscribe`,
      preferencesUrl: `${siteUrl}/welcome`,
      siteUrl,
    })
  );

  const subject = `The Boardroom Brief — ${date}`;

  // ── 5. Send in batches of 100 ────────────────────────────────────────────
  let successCount = 0;
  let failureCount = 0;
  const articleIds = articles.map((a) => a.slug).filter(Boolean);

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((to: string) =>
        resend.emails.send({
          from: "The Boardroom Brief <brief@theboardroombrief.com>",
          to,
          subject,
          html,
        })
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled") successCount++;
      else failureCount++;
    }
  }

  // ── 6. Log send to newsletter_sends ─────────────────────────────────────
  await supabase.from("newsletter_sends").insert({
    article_ids: articleIds,
    subscriber_count: emails.length,
    success_count: successCount,
    failure_count: failureCount,
  });

  return NextResponse.json({
    sent: successCount,
    failed: failureCount,
    subscribers: emails.length,
    articles: articleIds.length,
  });
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runSend();
}
