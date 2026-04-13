import Anthropic from "@anthropic-ai/sdk";
import type { AgentPersona, TopicBrief } from "./types";

export interface TopicContext {
  todayDate: string;
  recentArticleTitles: string[];   // last 7 days, same pillar
  marketSnapshot: object;           // from Supabase market_cache
  macroSnapshot: object;            // from Supabase macro_cache
  recentEarnings: object[];         // from earnings_covered last 48hrs
  trendingTopics: string[];         // from Google Trends proxy or static list
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function selectTopics(
  persona: AgentPersona,
  context: TopicContext
): Promise<TopicBrief[]> {
  const {
    todayDate,
    recentArticleTitles,
    marketSnapshot,
    macroSnapshot,
    recentEarnings,
    trendingTopics,
  } = context;

  const systemPrompt = `${persona.systemPrompt}

You are now in PLANNING mode. Your job is to decide what to write about today. Be selective — choose topics that are timely, have a clear angle, and will resonate with a senior professional audience. Avoid topics covered in the last 7 days.`;

  const recentTitlesBlock =
    recentArticleTitles.length > 0
      ? recentArticleTitles.map((t) => `- ${t}`).join("\n")
      : "No recent articles in this section.";

  const userPrompt = `Today is ${todayDate}.

Recent articles from your section (avoid repeating):
${recentTitlesBlock}

Today's market signals:
${JSON.stringify(marketSnapshot, null, 2)}

Latest macro data:
${JSON.stringify(macroSnapshot, null, 2)}

Recent earnings:
${recentEarnings.length > 0 ? JSON.stringify(recentEarnings, null, 2) : "No recent earnings to report."}

Trending global business topics:
${trendingTopics.map((t) => `- ${t}`).join("\n")}

Select 1 to 3 topics to write about today. Return only valid JSON array with no markdown, no explanation — just the array:
[{
  "title": "working headline (not final)",
  "angle": "the specific take, max 2 sentences",
  "dataPoints": ["key number or fact to include"],
  "wordCount": 600,
  "countries": ["economy slugs this covers"],
  "marketSymbols": ["relevant tickers if any"]
}]`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Strip markdown code fences if present
  const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();

  const parsed = JSON.parse(cleaned) as Array<{
    title: string;
    angle: string;
    dataPoints: string[];
    wordCount: number;
    countries?: string[];
    marketSymbols?: string[];
  }>;

  return parsed.map((item) => ({
    title: item.title,
    angle: item.angle,
    dataPoints: item.dataPoints ?? [],
    wordCount: item.wordCount ?? 700,
  }));
}
