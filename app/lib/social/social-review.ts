import Anthropic from "@anthropic-ai/sdk";
import { EDITOR_IN_CHIEF_PERSONA } from "@/app/lib/agents/editor";
import { callClaude, parseJSON, MODELS } from "@/app/lib/claude";
import { PLATFORM_RULES } from "./platform-rules";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripFences(raw: string): string {
  return raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
}

export interface SocialPostReview {
  score: number;
  passed: boolean;
  toneScore: number;
  accuracyScore: number;
  hookScore: number;
  satireScore: number;
  originalityScore: number;
  notes: string;
  revisionsRequired: string[];
}

export async function reviewSocialPost(
  platform: string,
  content: string,
  hashtags: string[],
  articleHeadline: string,
): Promise<SocialPostReview> {
  const hashtagLine = hashtags.length > 0
    ? `\nHASHTAGS: ${hashtags.map((h) => `#${h}`).join(" ")}`
    : "";

  const userPrompt = `Review this ${platform} social media post for The Alignment Times.

PLATFORM: ${platform}
ARTICLE HEADLINE: ${articleHeadline}
POST CONTENT:
${content}${hashtagLine}

Score across five dimensions (1-10 each). Apply the same editorial standards as articles, adapted for social media:

- Tone (1-10): Does it match The Alignment Times voice for ${platform}? Dry, informed, professionally safe — The Economist meets The Onion.
- Accuracy (1-10): Are all facts grounded in the article? No invented claims.
- Hook quality (1-10): Does the opening line stop the scroll? Would a CFO pause mid-feed?
- Satirical sharpness (1-10): Is the humour intelligent and earned? Punches at institutions, never individuals.
- Originality (1-10): Fresh angle, or generic business social content that could appear anywhere?

Pass threshold is 7.0 (average of five dimensions, rounded to 1 decimal). If below 7.0, provide specific revision notes.

Return only valid JSON:
{
  "toneScore": number,
  "accuracyScore": number,
  "hookScore": number,
  "satireScore": number,
  "originalityScore": number,
  "notes": "2-3 sentence editorial note",
  "revisionsRequired": []
}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
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
    hookScore: number;
    satireScore: number;
    originalityScore: number;
    notes: string;
    revisionsRequired: string[];
  };

  const computed =
    (result.toneScore + result.accuracyScore + result.hookScore +
      result.satireScore + result.originalityScore) / 5;
  const score = Math.round(computed * 10) / 10;
  const passed = score >= 7.0;

  return {
    score,
    passed,
    toneScore: result.toneScore,
    accuracyScore: result.accuracyScore,
    hookScore: result.hookScore,
    satireScore: result.satireScore,
    originalityScore: result.originalityScore,
    notes: result.notes,
    revisionsRequired: passed ? [] : (result.revisionsRequired ?? []),
  };
}

export async function reviseSocialPost(
  platform: string,
  content: string,
  hashtags: string[],
  review: SocialPostReview,
  articleHeadline: string,
  articleExcerpt: string,
): Promise<{ content: string; hashtags: string[] }> {
  const rules = PLATFORM_RULES[platform as "linkedin" | "twitter" | "instagram"];
  const revisionsBlock = review.revisionsRequired.length > 0
    ? review.revisionsRequired.map((r) => `- ${r}`).join("\n")
    : "General quality improvements required.";

  const hashtagLine = hashtags.length > 0
    ? `HASHTAGS: ${hashtags.map((h) => `#${h}`).join(" ")}\n`
    : "";

  const userPrompt = `Your Editor in Chief has reviewed your ${platform} post and requests revisions.

ORIGINAL POST:
${content}
${hashtagLine}
ARTICLE CONTEXT:
Headline: ${articleHeadline}
Excerpt: ${articleExcerpt}

EDITOR NOTES:
Score: ${review.score}/10
${review.notes}

SPECIFIC REVISIONS REQUIRED:
${revisionsBlock}

Rewrite the post addressing all revision notes. Return only valid JSON:
{
  "content": "string (the full revised post copy)",
  "hashtags": ["string array without # symbol"]
}`;

  const response = await callClaude(
    rules.systemPrompt,
    userPrompt,
    1200,
    `social:revise:${platform}`,
    MODELS.fast
  );

  return parseJSON<{ content: string; hashtags: string[] }>(response.content);
}
