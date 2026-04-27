import Anthropic from "@anthropic-ai/sdk";
import type { ArticleDraft } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PILLAR_STYLE_TEMPLATES: Record<string, {
  style: string;
  palette: string;
  mood: string;
  negative: string;
}> = {
  "markets-floor": {
    style:    "isometric financial illustration, data visualisation, stock charts, clean geometric shapes, professional",
    palette:  "deep navy blue, gold, white, dark charcoal",
    mood:     "authoritative, sharp, data-driven",
    negative: "people's faces, photography, realistic, dark or gloomy",
  },
  "macro-mondays": {
    style:    "flat editorial illustration, infographic style, minimalist icons, government buildings, globe, graphs",
    palette:  "teal, cream, slate grey, warm white",
    mood:     "informative, clean, slightly academic",
    negative: "people's faces, photography, clutter, dark backgrounds",
  },
  "c-suite-circus": {
    style:    "bold editorial illustration, satirical, boardroom scene, empty suits, PowerPoint presentation, office hierarchy",
    palette:  "bright red accent, charcoal, white, black",
    mood:     "satirical, knowing, slightly absurdist",
    negative: "photography, realistic faces, dark or depressing",
  },
  "global-office": {
    style:    "vintage travel poster aesthetic, city skyline, cultural architecture, flat illustration, world map elements",
    palette:  "warm ochre, terracotta, cream, muted blue",
    mood:     "curious, cultural, warm, inviting",
    negative: "photography, people's faces, cold or corporate",
  },
  "water-cooler": {
    style:    "bold graphic design, pop art, coffee cup, office plant, retro corporate aesthetic, flat design with texture",
    palette:  "bright coral, yellow, white, black",
    mood:     "playful, light, energetic, shareable",
    negative: "photography, dark mood, complex scenes",
  },
};

export async function generateImagePrompt(draft: ArticleDraft): Promise<string> {
  const template = PILLAR_STYLE_TEMPLATES[draft.pillar] ?? PILLAR_STYLE_TEMPLATES["water-cooler"];
  const topicSummary = draft.body.replace(/\n+/g, " ").slice(0, 100);
  const countries = draft.countries?.join(", ") || "global";

  const userPrompt = `Create an image generation prompt for this article:
Headline: ${draft.headline}
Pillar: ${draft.pillar}
Countries: ${countries}
Topic summary: ${topicSummary}

Style requirements:
${template.style}
Colour palette: ${template.palette}
Mood: ${template.mood}
Do NOT include: ${template.negative}

Write a single image generation prompt, 50-80 words.
Be specific about composition, colours, and style.
Do not include any real people, faces, logos, or text in the image.
Do not reference specific real companies by name.
Return only the prompt text, nothing else.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: "You write image generation prompts for editorial illustrations. You create prompts that produce abstract, concept-driven images — never portraits or faces of real people. Always professional, always on-brand.",
    messages: [{ role: "user", content: userPrompt }],
  });

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();
}
