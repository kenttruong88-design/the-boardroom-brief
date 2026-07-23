import Anthropic from "@anthropic-ai/sdk";
import { logClaudeUsage, MODELS } from "@/app/lib/claude";
import type { AgentPersona, TopicBrief } from "./types";

export interface NewsFeedStory {
  id?:            string;
  headline:       string;
  summary:        string;
  url?:           string;
  sourceName?:    string;
  relevanceScore: number;
  satiricalScore: number;
  /** Concrete facts extracted by the intel agent */
  keyFacts?:      string[];
  /** Direct quote from the story */
  notableQuote?:  string;
  /** Editorial angle suggested by the intel agent */
  suggestedAngle?: string;
}

export interface TopicContext {
  todayDate:            string;
  recentArticleTitles:  string[];
  marketSnapshot:       object;
  macroSnapshot:        object;
  recentEarnings:       object[];
  trendingTopics:       string[];
  searchGaps?:          string[];
  newsFeedStories?:     NewsFeedStory[];
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
    searchGaps = [],
    newsFeedStories = [],
  } = context;

  const systemPrompt = `${persona.systemPrompt}

You are now in PLANNING mode. Your job is to decide what to write about today. Be selective — choose topics that are timely, have a clear angle, and will resonate with a senior professional audience. Avoid topics covered in the last 7 days.

IMPORTANT: When breaking news stories are provided, prioritise them. Ground your articles in real events. Include the exact key facts provided — these are real numbers and names from the source article. Do not fabricate data points.`;

  const recentTitlesBlock =
    recentArticleTitles.length > 0
      ? recentArticleTitles.map((t) => `- ${t}`).join("\n")
      : "No recent articles in this section.";

  // Format breaking news stories with full richness
  const newsBlock =
    newsFeedStories.length > 0
      ? `Breaking news stories from the last 24 hours (prioritise these):
${newsFeedStories
  .map((s, i) => {
    const lines = [
      `${i + 1}. [Relevance ${s.relevanceScore}/10 | Satirical ${s.satiricalScore}/10]`,
      `   Headline: ${s.headline}`,
      `   Summary: ${s.summary}`,
    ];
    if (s.keyFacts && s.keyFacts.length > 0) {
      lines.push(`   Key facts: ${s.keyFacts.join(" • ")}`);
    }
    if (s.notableQuote) {
      lines.push(`   Quote: "${s.notableQuote}"`);
    }
    if (s.suggestedAngle) {
      lines.push(`   Suggested angle: ${s.suggestedAngle}`);
    }
    if (s.sourceName) {
      lines.push(`   Source: ${s.sourceName}${s.url ? ` (${s.url})` : ""}`);
    }
    return lines.join("\n");
  })
  .join("\n\n")}`
      : `No breaking news in feed yet. Use trending topics and market data below as your guide.`;

  const userPrompt = `Today is ${todayDate}.

${newsBlock}

Recent articles from your section (avoid repeating these topics):
${recentTitlesBlock}

Today\'s market signals:
${JSON.stringify(marketSnapshot, null, 2)}

Latest macro data:
${JSON.stringify(macroSnapshot, null, 2)}

Recent earnings:
${recentEarnings.length > 0 ? JSON.stringify(recentEarnings, null, 2) : "No recent earnings to report."}

Trending global business topics (use if no breaking news):
${trendingTopics.map((t) => `- ${t}`).join("\n")}
${searchGaps.length > 0 ? `\nReader search gaps (queries that returned no results):\n${searchGaps.map((g) => `- ${g}`).join("\n")}` : ""}

Select 1 to 2 topics to write about today. When using a breaking news story, copy the exact key facts into dataPoints — the journalist will use them verbatim.

Return only valid JSON array with no markdown:
[{
  "title": "working headline (not final)",
  "angle": "the specific take, max 2 sentences",
  "dataPoints": ["exact fact or number from the context — only real facts"],
  "wordCount": 600,
  "countries": ["economy slugs this covers"],
  "marketSymbols": ["relevant tickers if any"],
  "sourceUrl": "URL of the breaking news story this is based on, or null",
  "keyFacts": ["copy the keyFacts array from the news story if used, else []"],
  "notableQuote": "copy the notableQuote from the news story if used, else null"
}]`;

  const response = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 1200,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });
  logClaudeUsage("pipeline:topic-selector", MODELS.fast, response.usage.input_tokens, response.usage.output_tokens);

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as TopicBrief[] | TopicBrief;
    if (Array.isArray(parsed)) return parsed;
    // Claude occasionally returns a single object instead of a 1-element array
    if (parsed && typeof parsed === "object") {
      console.warn("[topic-selector] Claude returned single object — wrapping in array");
      return [parsed as TopicBrief];
    }
    return [];
  } catch {
    console.error("[topic-selector] JSON parse failed:", cleaned.slice(0, 200));
    return [];
  }
}
