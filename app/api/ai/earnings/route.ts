import { NextResponse } from "next/server";
import { callClaude, parseJSON } from "@/app/lib/claude";
import { writeClient } from "@/app/lib/sanity";
import { ECONOMIES } from "@/app/lib/mock-data";

const SYSTEM_PROMPT = `You write earnings coverage for The Boardroom Brief. You treat earnings calls like employee performance reviews — sympathetic but honest, with a corporate culture lens. Real numbers only. Satire is in the framing, not the facts.`;

// Economy country codes for filtering FMP results
const ECONOMY_CODES = new Set(ECONOMIES.map((e) => e.code));

interface FmpEarning {
  symbol: string;
  name: string;
  eps: number | null;
  epsEstimated: number | null;
  revenue: number | null;
  revenueEstimated: number | null;
  date: string;
  fiscalDateEnding: string;
}

interface EarningsDraft {
  headline: string;
  satiricalHeadline: string;
  summary: string;
}

function isAuthorized(req: Request): boolean {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") ?? req.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runEarnings();
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runEarnings();
}

async function sendSlackNotification(message: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch { /* non-fatal */ }
}

async function runEarnings() {
  const fmpKey = process.env.FMP_API_KEY;
  if (!fmpKey) {
    return NextResponse.json({ skipped: true, reason: "FMP_API_KEY not configured" });
  }

  // Fetch today's earnings from Financial Modeling Prep
  const today = new Date().toISOString().slice(0, 10);
  let earnings: FmpEarning[] = [];

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/earning_calendar?from=${today}&to=${today}&apikey=${fmpKey}`
    );
    if (res.ok) {
      earnings = await res.json() as FmpEarning[];
    }
  } catch {
    return NextResponse.json({ error: "Failed to fetch FMP earnings" }, { status: 500 });
  }

  if (earnings.length === 0) {
    return NextResponse.json({ drafted: 0, reason: "no earnings today" });
  }

  const results: { company: string; status: string; sanityId?: string; error?: string }[] = [];

  for (const report of earnings.slice(0, 10)) { // cap at 10 to control API costs
    try {
      const epsBeat = report.eps != null && report.epsEstimated != null
        ? report.eps >= report.epsEstimated ? "beat" : "missed"
        : "unknown";
      const epsPct = report.eps != null && report.epsEstimated != null && report.epsEstimated !== 0
        ? Math.abs(((report.eps - report.epsEstimated) / Math.abs(report.epsEstimated)) * 100).toFixed(1)
        : "N/A";

      const revBeat = report.revenue != null && report.revenueEstimated != null
        ? report.revenue >= report.revenueEstimated ? "beat" : "missed"
        : "unknown";

      const formatRev = (v: number | null) =>
        v == null ? "N/A" : v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : `$${(v / 1e6).toFixed(0)}M`;

      const userPrompt = `Company: ${report.name} (${report.symbol})
EPS: ${report.eps ?? "N/A"} vs ${report.epsEstimated ?? "N/A"} estimate (${epsBeat}${epsPct !== "N/A" ? ` by ${epsPct}%` : ""})
Revenue: ${formatRev(report.revenue)} vs ${formatRev(report.revenueEstimated)} (${revBeat})
CEO quote: Not available for this report.

Write:
- headline (straight news, include company name and key metric)
- satiricalHeadline (performance review framing, e.g. "Exceeds Expectations. Promises More of the Same.")
- summary (3 paragraphs, ~250 words total — para 1: the numbers, para 2: business context, para 3: dry corporate culture observation)
Return as JSON: {"headline": "...", "satiricalHeadline": "...", "summary": "..."}`;

      const { content } = await callClaude(SYSTEM_PROMPT, userPrompt, 1024, "earnings-draft");
      const draft = parseJSON<EarningsDraft>(content);

      let sanityId: string | undefined;
      if (writeClient) {
        const created = await writeClient.create({
          _type: "article",
          title: draft.headline,
          satiricalHeadline: draft.satiricalHeadline,
          excerpt: draft.summary.split("\n\n")[0] ?? "",
          body: [{
            _type: "block",
            _key: `earn_${Date.now()}`,
            style: "normal",
            children: [{ _type: "span", _key: "s1", text: draft.summary, marks: [] }],
            markDefs: [],
          }],
          publishedAt: new Date().toISOString(),
          readTime: 3,
          featured: false,
        });
        sanityId = created._id;

        await sendSlackNotification(
          `📋 New earnings draft ready for review: *${report.name}* (${report.symbol})\n"${draft.headline}"\nEdit in Sanity: https://theboardroombrief.com/studio`
        );
      }

      results.push({ company: report.name, status: "drafted", sanityId });
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      results.push({ company: report.name, status: "error", error: String(err) });
    }
  }

  const drafted = results.filter((r) => r.status === "drafted").length;
  return NextResponse.json({ drafted, total: results.length, results });
}
