import { NextResponse } from "next/server";
import { callClaude, parseJSON } from "@/app/lib/claude";

const SYSTEM_PROMPT = `You are the headline writer for The Boardroom Brief, a financial news site with a dry, satirical corporate culture twist. Your headlines acknowledge real financial news while adding a wry observation about office life, corporate-speak, or professional absurdity. Tone: The Economist meets The Onion. Safe for professional sharing. Never crude. Always informed. The humor should make a CFO chuckle, not cringe.`;

export async function POST(req: Request) {
  try {
    const { headline, excerpt, pillar, countries } = await req.json() as {
      headline: string;
      excerpt?: string;
      pillar?: string;
      countries?: string[];
    };

    if (!headline) {
      return NextResponse.json({ error: "headline is required" }, { status: 400 });
    }

    const userPrompt = `Straight headline: ${headline}
Article context: ${excerpt ?? "Not provided"}
Economy/region: ${countries?.join(", ") ?? "Global"}
Content pillar: ${pillar ?? "General"}

Generate 5 satirical subtitle variants (not replacement headlines — these are the witty subheadlines that appear in italics below the main headline). Each should be under 15 words. Return as a JSON array of strings, e.g. ["subtitle 1", "subtitle 2", ...]`;

    const { content } = await callClaude(
      SYSTEM_PROMPT,
      userPrompt,
      512,
      "headline-generator"
    );

    const headlines = parseJSON<string[]>(content);

    return NextResponse.json({ headlines });
  } catch (err) {
    console.error("[ai/headlines]", err);
    return NextResponse.json({ error: "Failed to generate headlines" }, { status: 500 });
  }
}
