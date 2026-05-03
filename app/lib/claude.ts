import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "./supabase-server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Model registry ────────────────────────────────────────────────────────────
// Update here when Anthropic releases new model versions.

export const MODELS = {
  default:   "claude-sonnet-4-20250514",
  fast:      "claude-haiku-4-5-20251001",
  powerful:  "claude-opus-4-6",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

// ── Cost table (USD per million tokens) ──────────────────────────────────────

const COST_TABLE: Record<string, { input: number; output: number }> = {
  [MODELS.default]:  { input: 3.00,  output: 15.00 },
  [MODELS.fast]:     { input: 0.80,  output: 4.00  },
  [MODELS.powerful]: { input: 15.00, output: 75.00 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = COST_TABLE[model] ?? COST_TABLE[MODELS.default];
  return (
    (inputTokens  / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

// ── Usage logging ─────────────────────────────────────────────────────────────

export async function logClaudeUsage(
  calledFrom: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("claude_usage").insert({
      called_from:    calledFrom,
      model,
      input_tokens:   inputTokens,
      output_tokens:  outputTokens,
      estimated_cost: estimateCost(model, inputTokens, outputTokens),
    });
  } catch {
    // Non-fatal — never let logging break the caller
  }
}

// ── callClaude ────────────────────────────────────────────────────────────────

/**
 * Call Claude with retry logic (3 attempts, exponential backoff).
 *
 * @param systemPrompt  System instructions for the call
 * @param userPrompt    The user message
 * @param maxTokens     Max tokens for the response (default 1000)
 * @param calledFrom    Identifier logged to claude_usage (default "unknown")
 * @param model         Model ID to use (default MODELS.default = Sonnet)
 */
export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1000,
  calledFrom = "unknown",
  model: string = MODELS.default
): Promise<ClaudeResponse> {
  const MAX_ATTEMPTS = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const inputTokens  = message.usage.input_tokens;
      const outputTokens = message.usage.output_tokens;

      // Fire-and-forget — don't await logging
      logClaudeUsage(calledFrom, model, inputTokens, outputTokens);

      const content =
        message.content[0].type === "text" ? message.content[0].text : "";

      return { content, inputTokens, outputTokens };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError ?? new Error("Claude API call failed after 3 attempts");
}

// ── parseJSON ─────────────────────────────────────────────────────────────────

/**
 * Parse JSON from Claude's response, stripping markdown code fences if present.
 */
export function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
