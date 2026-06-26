import Anthropic from "@anthropic-ai/sdk";
import { logClaudeUsage, MODELS } from "@/app/lib/claude";
import { generateArticleImage } from "./image-generator";
import type { AgentPersona, TopicBrief, ArticleDraft } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripFences(raw: string): string {
  return raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
}

// ── Option 2: Research step using web_search ─────────────────────────────────
// If the topic brief has a sourceUrl, search for the story before writing.
// This gives the journalist full article context rather than just the summary.

async function researchStory(topic: TopicBrief): Promise<string> {
  if (!topic.sourceUrl) return "";

  try {
    const researchResponse = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 1000,
      system: `You are a research assistant for a financial news publication. 
Search for the story at the given URL or by headline and extract:
- The most important facts, numbers, and named individuals
- Any direct quotes from key figures
- Key context that makes this story significant
- Any follow-up reporting or reactions published today

Be concise and factual. Return a short research brief (200-300 words) the journalist can write from.`,
      tools: [
        {
          type: "web_search_20250305" as const,
          name: "web_search",
        },
      ],
      messages: [
        {
          role: "user",
          content: `Research this story for a journalist who needs to write about it:\n\nHeadline: ${topic.title}\nSource URL: ${topic.sourceUrl}\n\nSearch for the story and any related coverage from the last 24 hours. Extract the key facts the journalist should include.`,
        },
      ],
    });
    logClaudeUsage("pipeline:article-writer:research", MODELS.fast, researchResponse.usage.input_tokens, researchResponse.usage.output_tokens);

    const textBlocks = researchResponse.content.filter((b) => b.type === "text");
    if (textBlocks.length === 0) return "";

    return textBlocks
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();
  } catch (err) {
    // Research is best-effort — proceed without it if it fails
    console.warn("[article-writer] Research step failed:", (err as Error).message);
    return "";
  }
}

// ── writeArticle ──────────────────────────────────────────────────────────────

export async function writeArticle(
  persona: AgentPersona,
  topic: TopicBrief
): Promise<ArticleDraft> {

  // ── STEP 0 — Research (Option 2: web_search for source story) ────────────────
  // Run research in parallel with nothing else — it must complete before writing.
  const researchContext = await researchStory(topic);

  // ── STEP 1 — Write the article body ─────────────────────────────────────────

  const writeSystem = `${persona.systemPrompt}

You are now in WRITING mode. Write the full article based on the brief and research provided.

Rules:
- Write in your established voice
- Use the exact data points, names, and numbers from the brief and research — do not round or approximate
- If a direct quote is provided, use it (attribute it correctly)
- Do not pad. Do not hedge unnecessarily
- The Alignment Times reader is smart and busy
- No markdown headers, no bullet points — this is journalism`;

  // Build the source material block from what we have
  const sourceLines: string[] = [];

  if (topic.keyFacts && topic.keyFacts.length > 0) {
    sourceLines.push(`Key facts from the source story:\n${topic.keyFacts.map((f) => `  - ${f}`).join("\n")}`);
  }

  if (topic.notableQuote) {
    sourceLines.push(`Notable quote (use this verbatim if it fits): "${topic.notableQuote}"`);
  }

  if (researchContext) {
    sourceLines.push(`Research brief (fresh context from web search):\n${researchContext}`);
  }

  const sourceMaterialBlock = sourceLines.length > 0
    ? `\n\nSource material:\n${sourceLines.join("\n\n")}`
    : "";

  const writeUser = `Write a full article for The Alignment Times.

Section: ${persona.pillar}
Working title: ${topic.title}
Your angle: ${topic.angle}
Data points to include: ${(topic.dataPoints ?? []).join(", ")}
Target word count: ${topic.wordCount}${sourceMaterialBlock}

Return only valid JSON with no markdown, no explanation — just the object:
{
  "headline": "max 12 words, punchy and specific",
  "satiricalHeadline": "witty subheadline max 12 words, the dry observation that makes a CFO snort",
  "body": "full article, paragraphs separated by double newline, no markdown headers, no bullet points — this is journalism not a listicle",
  "pullQuote": "the single most quotable line from the article, 10-20 words, for the article page callout"
}`;

  const writeResponse = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 2048,
    system: writeSystem,
    messages: [{ role: "user", content: writeUser }],
  });
  logClaudeUsage("pipeline:article-writer:write", MODELS.fast, writeResponse.usage.input_tokens, writeResponse.usage.output_tokens);

  const writeRaw = writeResponse.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  let writeResult: { headline: string; satiricalHeadline: string; body: string; pullQuote: string };
  try {
    writeResult = JSON.parse(stripFences(writeRaw));
  } catch (err) {
    throw new Error(
      `[article-writer] Failed to parse write response for "${topic.title}": ${(err as Error).message}. ` +
      `Raw (first 300): ${writeRaw.slice(0, 300)}`
    );
  }

  const { headline, satiricalHeadline, body } = writeResult;
  const excerpt = body.replace(/\n+/g, " ").slice(0, 150);

  const partialDraft: ArticleDraft = {
    pillar:            persona.pillar,
    agentName:         persona.name,
    topicBrief:        topic,
    headline,
    satiricalHeadline,
    body,
    seoTitle:          "",
    seoDescription:    "",
    tags:              [],
    tone:              "hybrid",
    marketSymbols:     [],
    countries:         [],
  };

  // ── STEP 2 — SEO metadata + image generation in parallel ─────────────────────

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

  const [metaResponse, imageResult] = await Promise.all([
    client.messages.create({
      model: MODELS.fast,
      max_tokens: 512,
      system: "You are an SEO and content metadata specialist for a financial news publication.",
      messages: [{ role: "user", content: metaUser }],
    }).then((r) => {
      logClaudeUsage("pipeline:article-writer:seo", MODELS.fast, r.usage.input_tokens, r.usage.output_tokens);
      return r;
    }),
    generateArticleImage(partialDraft).catch((err) => {
      console.error("[article-writer] Unexpected image error:", (err as Error).message);
      return null;
    }),
  ]);

  const metaRaw = metaResponse.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // SEO parse is non-fatal — fall back to empty values so the written body is not lost
  let metaResult: { seoTitle: string; seoDescription: string; tags: string[]; tone: "satire" | "straight" | "hybrid" };
  try {
    metaResult = JSON.parse(stripFences(metaRaw));
  } catch (err) {
    console.error(`[article-writer] SEO parse failed for "${headline}" — using empty metadata:`, (err as Error).message);
    metaResult = { seoTitle: headline.slice(0, 60), seoDescription: "", tags: [], tone: "hybrid" };
  }

  const draft: ArticleDraft = {
    pillar:            persona.pillar,
    agentName:         persona.name,
    topicBrief:        topic,
    headline,
    satiricalHeadline,
    body,
    seoTitle:          metaResult.seoTitle,
    seoDescription:    metaResult.seoDescription,
    tags:              metaResult.tags ?? [],
    tone:              metaResult.tone ?? "hybrid",
    marketSymbols:     [],
    countries:         [],
  };

  if (imageResult) {
    draft.featuredImage = {
      cloudinaryPublicId: imageResult.publicId,
      url:                imageResult.url,
      heroUrl:            imageResult.heroUrl,
      thumbnailUrl:       imageResult.thumbnailUrl,
      ogImageUrl:         imageResult.ogImageUrl,
      mobileUrl:          imageResult.mobileUrl,
      altText:            headline,
      source:             imageResult.source,
      generatedPrompt:    imageResult.generatedPrompt,
      photographerName:   imageResult.photographerName,
      photographerUrl:    imageResult.photographerUrl,
      pexelsPageUrl:      imageResult.pexelsPageUrl,
      durationMs:         imageResult.durationMs,
    };
  }

  return draft;
}
