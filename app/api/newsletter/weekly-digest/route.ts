import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/app/lib/supabase";
import { client as sanityClient } from "@/app/lib/sanity";

function isAuthorized(req: Request): boolean {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") ?? req.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runWeeklyDigest();
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runWeeklyDigest();
}

async function runWeeklyDigest() {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

  const supabase = createAdminClient();
  const resend = new Resend(resendKey);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealignmenttimes.com";

  // Fetch confirmed subscribers
  const { data: subscribers } = await supabase
    .from("subscribers")
    .select("email")
    .eq("confirmed", true)
    .is("unsubscribed_at", null);

  const emails = (subscribers ?? []).map((s: { email: string }) => s.email);
  if (emails.length === 0) return NextResponse.json({ sent: 0, reason: "no subscribers" });

  // Fetch top articles from last 7 days
  let articles: { title: string; satiricalHeadline?: string; slug: { current: string }; pillar?: { name: string; slug: { current: string } } }[] = [];
  if (sanityClient) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    articles = await sanityClient.fetch(
      `*[_type == "article" && publishedAt > "${since}"] | order(featured desc, publishedAt desc) [0...10] {
        title, slug, satiricalHeadline, pillar->{ name, slug }
      }`
    );
  }

  const weekLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Build plain HTML weekly digest
  const articlesHtml = articles.map((a, i) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #ddd8ce;">
        <span style="color:#888;font-size:11px;font-family:Arial,sans-serif;">${(a.pillar?.name ?? "").toUpperCase()}</span><br>
        <a href="${siteUrl}/${a.pillar?.slug?.current ?? "markets-floor"}/${a.slug.current}"
           style="color:#0f1923;font-size:15px;font-family:Georgia,serif;font-weight:700;text-decoration:none;line-height:1.3;">
          ${a.title}
        </a><br>
        <span style="color:#c8391a;font-size:12px;font-family:Georgia,serif;font-style:italic;">${a.satiricalHeadline ?? ""}</span>
      </td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="background:#f5f0e8;margin:0;padding:0;font-family:Georgia,serif;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#0f1923;padding:24px;border-bottom:3px solid #c8391a;">
          <div style="color:#f5f0e8;font-size:26px;font-family:Georgia,serif;font-weight:700;">The Alignment Times</div>
          <div style="color:rgba(245,240,232,0.55);font-size:12px;font-family:Arial,sans-serif;margin-top:4px;">Weekly Digest — week ending ${weekLabel}</div>
        </td></tr>

        <!-- Intro -->
        <tr><td style="padding:24px;background:#f5f0e8;border-bottom:1px solid #ddd8ce;">
          <p style="color:#0f1923;font-size:16px;margin:0 0 8px;">This week in brief.</p>
          <p style="color:#555;font-size:14px;font-family:Arial,sans-serif;line-height:1.6;margin:0;">
            ${articles.length} stories. Five working days. An unknowable number of meetings that could have been emails. Here's what mattered.
          </p>
        </td></tr>

        <!-- Articles -->
        <tr><td style="padding:0 24px;background:#f5f0e8;">
          <p style="color:#0f1923;font-size:10px;font-family:Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;font-weight:700;padding-top:20px;">
            This week's coverage
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${articlesHtml || '<tr><td style="padding:20px 0;color:#888;font-size:13px;font-family:Arial,sans-serif;">No articles this week.</td></tr>'}
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#e8e2d8;padding:16px 24px;text-align:center;">
          <p style="color:#888;font-size:11px;font-family:Arial,sans-serif;margin:0 0 6px;">
            <a href="${siteUrl}/welcome" style="color:#888;">Manage preferences</a> &nbsp;·&nbsp;
            <a href="${siteUrl}/unsubscribe" style="color:#888;">Unsubscribe</a> &nbsp;·&nbsp;
            <a href="${siteUrl}" style="color:#888;">Visit site</a>
          </p>
          <p style="color:#aaa;font-size:10px;font-family:Arial,sans-serif;margin:0;">
            © ${new Date().getFullYear()} The Alignment Times. Real markets. Real news. Questionable corporate poetry.
          </p>
        </td></tr>

      </table>
      </td></tr></table>
    </body></html>
  `;

  // Send in batches of 100
  let successCount = 0;
  let failureCount = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100);
    const results = await Promise.allSettled(
      batch.map((to: string) => resend.emails.send({
        from: "The Alignment Times <brief@thealignmenttimes.com>",
        to,
        subject: `The Alignment Times — Weekly Digest (${weekLabel})`,
        html,
      }))
    );
    for (const r of results) {
      if (r.status === "fulfilled") successCount++;
      else failureCount++;
    }
  }

  return NextResponse.json({ sent: successCount, failed: failureCount, articles: articles.length });
}
