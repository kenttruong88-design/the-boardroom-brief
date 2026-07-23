import Anthropic from "@anthropic-ai/sdk";
import { logClaudeUsage, MODELS } from "@/app/lib/claude";
import type { ArticleDraft } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface PhotoCandidate {
  id: string;
  thumbnailUrl: string;
  alt?: string;
}

// 1. Turn the article into a short, concrete stock photo search query.
export async function generatePhotoSearchQuery(draft: ArticleDraft): Promise<string> {
  const topicSummary = draft.body.replace(/\n+/g, " ").slice(0, 300);
  const countries = draft.countries?.join(", ") || "global";

  const response = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 24,
    system:
      "You write stock photo search queries for a financial news site. " +
      "Return only the query: 3-6 concrete visual words describing a photographable real-world scene. " +
      "No abstract concepts, no satire, no punctuation, no quotes.",
    messages: [{
      role: "user",
      content:
        `Headline: ${draft.headline}\n` +
        `Pillar: ${draft.pillar}\n` +
        `Countries: ${countries}\n` +
        `Summary: ${topicSummary}\n\n` +
        "Write one stock photo search query for this article.",
    }],
  });
  logClaudeUsage("pipeline:photo-query", MODELS.fast, response.usage.input_tokens, response.usage.output_tokens);

  const query = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim()
    .replace(/^["']+|["']+$/g, "");

  if (!query || query.length > 80) throw new Error(`Bad photo query: "${query}"`);
  return query;
}

// 2. Show candidate thumbnails to Claude, let it pick the most relevant one.
//    Returns an index into `candidates`, or null when there is no confident pick.
export async function pickBestPhoto(
  candidates: PhotoCandidate[],
  draft: ArticleDraft
): Promise<number | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return 0;

  const content: Anthropic.ContentBlockParam[] = [];
  candidates.forEach((c, i) => {
    content.push({ type: "text", text: `Photo ${i + 1}${c.alt ? ` (${c.alt.slice(0, 60)})` : ""}:` });
    content.push({ type: "image", source: { type: "url", url: c.thumbnailUrl } });
  });
  content.push({
    type: "text",
    text:
      "These are stock photo candidates for the featured image of a financial news article.\n" +
      `Headline: ${draft.headline}\n` +
      `Pillar: ${draft.pillar}\n` +
      `Tags: ${(draft.tags ?? []).slice(0, 5).join(", ")}\n\n` +
      "Pick the photo that best matches the article subject and looks least like generic stock photography. " +
      `Answer with only the photo number (1-${candidates.length}).`,
  });

  const response = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 8,
    messages: [{ role: "user", content }],
  });
  logClaudeUsage("pipeline:photo-pick", MODELS.fast, response.usage.input_tokens, response.usage.output_tokens);

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  const n = parseInt(text.match(/\d+/)?.[0] ?? "", 10);
  if (!Number.isFinite(n) || n < 1 || n > candidates.length) return null;
  return n - 1;
}
