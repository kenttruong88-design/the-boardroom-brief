import Anthropic from "@anthropic-ai/sdk";
import { EDITOR_IN_CHIEF_PERSONA } from "./editor";
import type { AgentPersona, ArticleDraft, EditorReview } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripFences(raw: string): string {
  return raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── reviewArticle ─────────────────────────────────────────────────────────────

export async function reviewArticle(
  draft: ArticleDraft,
  articleIndex = 0
): Promise<EditorReview> {
  const userPrompt = `Review this article from ${draft.agentName} for The Boardroom Brief.

HEADLINE: ${draft.headline}
SATIRICAL SUBHEADLINE: ${draft.satiricalHeadline}
PILLAR: ${draft.pillar}
BODY:
${draft.body}

Score this article across all five dimensions. If any dimension scores below 7, provide specific revision notes. Be direct. Be precise. Explain exactly what needs to change.

Return only valid JSON with no markdown, no explanation — just the object:
{
  "toneScore": number,
  "accuracyScore": number,
  "headlineScore": number,
  "satireScore": number,
  "originalityScore": number,
  "overallScore": number,
  "passed": boolean,
  "notes": "overall editorial note, 2-3 sentences",
  "revisionsRequired": ["specific change required if not passed"]
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: EDITOR_IN_CHIEF_PERSONA.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const result = JSON.parse(stripFences(raw)) as {
    toneScore: number;
    accuracyScore: number;
    headlineScore: number;
    satireScore: number;
    originalityScore: number;
    overallScore: number;
    passed: boolean;
    notes: string;
    revisionsRequired: string[];
  };

  // Recalculate score from components to guard against model arithmetic errors
  const computed =
    (result.toneScore + result.accuracyScore + result.headlineScore +
      result.satireScore + result.originalityScore) / 5;
  const score = Math.round(computed * 10) / 10;

  return {
    articleIndex,
    score,
    passed: score >= 7.0,
    toneScore: result.toneScore,
    accuracyScore: result.accuracyScore,
    headlineScore: result.headlineScore,
    satireScore: result.satireScore,
    originalityScore: result.originalityScore,
    notes: result.notes,
    revisionsRequired: result.passed ? [] : (result.revisionsRequired ?? []),
  };
}

// ── reviseArticle ─────────────────────────────────────────────────────────────

export async function reviseArticle(
  persona: AgentPersona,
  draft: ArticleDraft,
  review: EditorReview
): Promise<ArticleDraft> {
  const revisionsBlock =
    review.revisionsRequired.length > 0
      ? review.revisionsRequired.map((r) => `- ${r}`).join("\n")
      : "General quality improvements required.";

  const userPrompt = `Your Editor in Chief has reviewed your article and requests revisions before publication.

YOUR ORIGINAL ARTICLE:
Headline: ${draft.headline}
Body:
${draft.body}

EDITOR NOTES:
Overall score: ${review.score}/10
${review.notes}

SPECIFIC REVISIONS REQUIRED:
${revisionsBlock}

Rewrite the article addressing all revision notes. Return only valid JSON with no markdown, no explanation — just the object:
{
  "headline": "revised headline",
  "satiricalHeadline": "revised satirical subheadline",
  "body": "full revised article, paragraphs separated by double newline",
  "pullQuote": "revised pull quote, 10-20 words"
}`;

  const writeResponse = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: persona.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = writeResponse.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const revised = JSON.parse(stripFences(raw)) as {
    headline: string;
    satiricalHeadline: string;
    body: string;
    pullQuote: string;
  };

  const revisedDraft: ArticleDraft = {
    ...draft,
    headline: revised.headline,
    satiricalHeadline: revised.satiricalHeadline,
    body: revised.body,
  };

  // ── Re-review the revised draft (one attempt only) ───────────────────────────
  await sleep(2000);
  const secondReview = await reviewArticle(revisedDraft, draft.topicBrief.title ? -1 : 0);

  if (secondReview.passed) {
    return revisedDraft;
  }

  // Still below threshold — mark as dropped and return the best version
  console.warn(
    `[editor-review] Article "${draft.headline}" dropped after revision. ` +
    `Score: ${secondReview.score}/10`
  );
  return revisedDraft;
}
