import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ModerationResult {
  approved: boolean;
  spamScore: number;       // 0–10
  toxicityScore: number;   // 0–10
  relevanceScore: number;  // 0–10
  reason: string;
}

const SYSTEM = `You are a comment moderator for The Boardroom Brief, a satirical business news site. Evaluate each comment and return a JSON object — nothing else.

Rules:
- Approve thoughtful, on-topic, or witty comments even if critical
- Reject spam, ads, personal attacks, hate speech, or gibberish
- Score spam: 0 = not spam, 10 = obvious spam/ad
- Score toxicity: 0 = civil, 10 = severe harassment/hate
- Score relevance: 10 = directly on-topic, 0 = completely off-topic

Return ONLY valid JSON:
{
  "approved": true|false,
  "spamScore": 0-10,
  "toxicityScore": 0-10,
  "relevanceScore": 0-10,
  "reason": "one sentence"
}`;

export async function moderateComment(
  body: string,
  articleTitle: string
): Promise<ModerationResult> {
  const userMsg = `Article: "${articleTitle}"\n\nComment: "${body}"`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const parsed = JSON.parse(text) as {
    approved: boolean;
    spamScore: number;
    toxicityScore: number;
    relevanceScore: number;
    reason: string;
  };

  // Auto-reject if spam > 7 or toxicity > 6
  const approved =
    parsed.approved &&
    parsed.spamScore <= 7 &&
    parsed.toxicityScore <= 6;

  return {
    approved,
    spamScore: parsed.spamScore,
    toxicityScore: parsed.toxicityScore,
    relevanceScore: parsed.relevanceScore,
    reason: parsed.reason,
  };
}
