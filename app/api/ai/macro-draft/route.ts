import { NextResponse } from "next/server";
import { callClaude, parseJSON } from "@/app/lib/claude";
import { writeClient } from "@/app/lib/sanity";
import { ECONOMIES } from "@/app/lib/mock-data";

const SYSTEM_PROMPT = `You are a staff writer at The Boardroom Brief. You write about macroeconomic data in a way that's accurate, informative, and laced with dry corporate humor. You never make up numbers. You only interpret real data provided to you.`;

type Indicator = "gdp" | "inflation" | "unemployment";

const WB_INDICATORS: Record<Indicator, { code: string; label: string; unit: string }> = {
  gdp:          { code: "NY.GDP.MKTP.KD.ZG", label: "GDP Growth Rate", unit: "%" },
  inflation:    { code: "FP.CPI.TOTL.ZG",    label: "Inflation Rate",  unit: "%" },
  unemployment: { code: "SL.UEM.TOTL.ZS",    label: "Unemployment Rate", unit: "%" },
};

async function fetchWBTimeSeries(countryCode: string, indicatorCode: string) {
  const res = await fetch(
    `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorCode}?format=json&mrv=2`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return (data?.[1] ?? []) as { value: number | null; date: string }[];
}

interface DraftResult {
  headline: string;
  subheadlines: string[];
  body: string;
}

// Runs all 30 economies for a given indicator — called by cron
async function draftAllEconomies(indicator: Indicator) {
  const results: { economy: string; status: string; error?: string }[] = [];

  for (const economy of ECONOMIES) {
    try {
      const series = await fetchWBTimeSeries(economy.code, WB_INDICATORS[indicator].code);
      if (!series || series.length < 2) {
        results.push({ economy: economy.name, status: "skipped", error: "insufficient data" });
        continue;
      }

      const [latest, prev] = series;
      if (latest.value == null || prev.value == null) {
        results.push({ economy: economy.name, status: "skipped", error: "null values" });
        continue;
      }

      const change = latest.value - prev.value;
      const { label, unit } = WB_INDICATORS[indicator];

      const userPrompt = `Country: ${economy.name}
Indicator: ${label}
Latest value: ${latest.value.toFixed(2)}${unit} (${latest.date})
Previous value: ${prev.value.toFixed(2)}${unit} (${prev.date})
Change: ${change > 0 ? "+" : ""}${change.toFixed(2)}${unit}

Write a 3-paragraph article draft:
- Para 1: The news straight (factual, with the real numbers)
- Para 2: Context and what this means for businesses operating in ${economy.name}
- Para 3: A wry observation about what this means for the average office worker there

Also suggest a headline and 3 satirical subheadline options.
Return as JSON: {"headline": "...", "subheadlines": ["...", "...", "..."], "body": "para1\\n\\npara2\\n\\npara3"}`;

      const { content } = await callClaude(SYSTEM_PROMPT, userPrompt, 1024, "macro-draft");
      const draft = parseJSON<DraftResult>(content);

      // Create draft in Sanity
      if (writeClient) {
        await writeClient.create({
          _type: "article",
          title: draft.headline,
          satiricalHeadline: draft.subheadlines[0] ?? "",
          excerpt: draft.body.split("\n\n")[0] ?? "",
          body: [
            {
              _type: "block",
              _key: "auto1",
              style: "normal",
              children: [{ _type: "span", _key: "s1", text: draft.body, marks: [] }],
              markDefs: [],
            },
          ],
          publishedAt: new Date().toISOString(),
          readTime: 3,
          featured: false,
        });
      }

      results.push({ economy: economy.name, status: "drafted" });

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      results.push({ economy: economy.name, status: "error", error: String(err) });
    }
  }

  return results;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Also allow direct API calls with secret header
    const secret = req.headers.get("x-cron-secret");
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await req.json().catch(() => ({})) as { countryCode?: string; indicator?: Indicator; all?: boolean };
    const { countryCode, indicator = "gdp", all = false } = body;

    if (all) {
      // Draft all 30 economies (called by monthly cron)
      const results = await draftAllEconomies(indicator);
      const drafted = results.filter((r) => r.status === "drafted").length;
      return NextResponse.json({ drafted, total: results.length, results });
    }

    // Single economy draft
    const economy = ECONOMIES.find(
      (e) => e.code === countryCode || e.slug === countryCode
    );
    if (!economy) {
      return NextResponse.json({ error: "Economy not found" }, { status: 404 });
    }

    const series = await fetchWBTimeSeries(economy.code, WB_INDICATORS[indicator].code);
    if (!series || series.length < 2 || series[0].value == null || series[1].value == null) {
      return NextResponse.json({ error: "Insufficient World Bank data" }, { status: 422 });
    }

    const [latest, prev] = series;
    const change = (latest.value as number) - (prev.value as number);
    const { label, unit } = WB_INDICATORS[indicator];

    const userPrompt = `Country: ${economy.name}
Indicator: ${label}
Latest value: ${(latest.value as number).toFixed(2)}${unit} (${latest.date})
Previous value: ${(prev.value as number).toFixed(2)}${unit} (${prev.date})
Change: ${change > 0 ? "+" : ""}${change.toFixed(2)}${unit}

Write a 3-paragraph article draft:
- Para 1: The news straight (factual, with the real numbers)
- Para 2: Context and what this means for businesses operating in ${economy.name}
- Para 3: A wry observation about what this means for the average office worker there

Also suggest a headline and 3 satirical subheadline options.
Return as JSON: {"headline": "...", "subheadlines": ["...", "...", "..."], "body": "para1\\n\\npara2\\n\\npara3"}`;

    const { content } = await callClaude(SYSTEM_PROMPT, userPrompt, 1024, "macro-draft");
    const draft = parseJSON<DraftResult>(content);

    // Create draft in Sanity
    let sanityId: string | null = null;
    if (writeClient) {
      const created = await writeClient.create({
        _type: "article",
        title: draft.headline,
        satiricalHeadline: draft.subheadlines[0] ?? "",
        excerpt: draft.body.split("\n\n")[0] ?? "",
        body: [
          {
            _type: "block",
            _key: "auto1",
            style: "normal",
            children: [{ _type: "span", _key: "s1", text: draft.body, marks: [] }],
            markDefs: [],
          },
        ],
        publishedAt: new Date().toISOString(),
        readTime: 3,
        featured: false,
      });
      sanityId = created._id;
    }

    return NextResponse.json({
      economy: economy.name,
      indicator,
      draft,
      sanityId,
    });
  } catch (err) {
    console.error("[ai/macro-draft]", err);
    return NextResponse.json({ error: "Draft generation failed" }, { status: 500 });
  }
}
