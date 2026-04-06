import { NextResponse } from "next/server";
import { callClaude, parseJSON } from "@/app/lib/claude";

const SYSTEM_PROMPT = `You are an SEO specialist for a financial news publication. Generate metadata that balances search intent with the site's editorial voice.`;

interface SeoResult {
  seoTitle: string;
  seoDescription: string;
  tags: string[];
}

export async function POST(req: Request) {
  try {
    const { headline, satiricalHeadline, excerpt, pillar, countries } = await req.json() as {
      headline: string;
      satiricalHeadline?: string;
      excerpt?: string;
      pillar?: string;
      countries?: string[];
    };

    if (!headline) {
      return NextResponse.json({ error: "headline is required" }, { status: 400 });
    }

    const userPrompt = `Article: ${headline}${satiricalHeadline ? ` — ${satiricalHeadline}` : ""}
Excerpt: ${excerpt ?? "Not provided"}
Pillar: ${pillar ?? "General"}
Economies: ${countries?.join(", ") ?? "Global"}

Generate:
- seoTitle (60 chars max, include main keyword naturally)
- seoDescription (155 chars max, compelling, includes a light editorial angle)
- 5 relevant tags for this article

Return as JSON: {"seoTitle": "...", "seoDescription": "...", "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]}`;

    const { content } = await callClaude(
      SYSTEM_PROMPT,
      userPrompt,
      512,
      "seo-generator"
    );

    const result = parseJSON<SeoResult>(content);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[ai/seo]", err);
    return NextResponse.json({ error: "Failed to generate SEO metadata" }, { status: 500 });
  }
}
