import Anthropic from "@anthropic-ai/sdk";
import type { AgentPersona, TopicBrief, ArticleDraft } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripFences(raw: string): string {
  return raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
}

export async function writeArticle(
  persona: AgentPersona,
  topic: TopicBrief
): Promise<ArticleDraft> {
  // ── CALL 1 — Write the article body ─────────────────────────────────────────

  const writeSystem = `${persona.systemPrompt}

You are now in WRITING mode. Write the full article based on the brief provided. Write in your established voice. Be specific — use the data points provided. Do not pad. Do not hedge unnecessarily. The Boardroom Brief reader is smart and busy.`;

  const writeUser = `Write a full article for The Boardroom Brief.

Section: ${persona.pillar}
Working title: ${topic.title}
Your angle: ${topic.angle}
Key data points to include: ${topic.dataPoints.join(", ")}
Target word count: ${topic.wordCount}

Return only valid JSON with no markdown, no explanation — just the object:
{
  "headline": "max 12 words, punchy and specific",
  "satiricalHeadline": "witty subheadline max 12 words, the dry observation that makes a CFO snort",
  "body": "full article, paragraphs separated by double newline, no markdown headers, no bullet points — this is journalism not a listicle",
  "pullQuote": "the single most quotable line from the article, 10-20 words, for the article page callout"
}`;

  const writeResponse = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: writeSystem,
    messages: [{ role: "user", content: writeUser }],
  });

  const writeRaw = writeResponse.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const writeResult = JSON.parse(stripFences(writeRaw)) as {
    headline: string;
    satiricalHeadline: string;
    body: string;
    pullQuote: string;
  };

  const { headline, satiricalHeadline, body } = writeResult;
  const excerpt = body.replace(/\n+/g, " ").slice(0, 150);

  // ── 2-second delay between calls ────────────────────────────────────────────
  await sleep(2000);

  // ── CALL 2 — Generate metadata ───────────────────────────────────────────────

  const metaUser = `Article headline: ${headline}
Article excerpt (first 150 chars of body): ${excerpt}
Pillar: ${persona.pillar}

Return only valid JSON with no markdown, no explanation — just the object:
{
  "seoTitle": "max 60 chars, includes primary keyword",
  "seoDescription": "max 155 chars, compelling",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "tone": "satire or straight or hybrid"
}`;

  const metaResponse = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: "You are an SEO and content metadata specialist for a financial news publication.",
    messages: [{ role: "user", content: metaUser }],
  });

  const metaRaw = metaResponse.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const metaResult = JSON.parse(stripFences(metaRaw)) as {
    seoTitle: string;
    seoDescription: string;
    tags: string[];
    tone: "satire" | "straight" | "hybrid";
  };

  // ── Merge into ArticleDraft ──────────────────────────────────────────────────

  return {
    pillar: persona.pillar,
    agentName: persona.name,
    topicBrief: topic,
    headline,
    satiricalHeadline,
    body,
    seoTitle: metaResult.seoTitle,
    seoDescription: metaResult.seoDescription,
    tags: metaResult.tags ?? [],
    tone: metaResult.tone ?? "hybrid",
    marketSymbols: [],
    countries: [],
  };
}
