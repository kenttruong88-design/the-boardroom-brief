import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "./supabase-server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

// Cost per million tokens (claude-sonnet-4-6 pricing)
const COST_PER_M_INPUT  = 3.00;
const COST_PER_M_OUTPUT = 15.00;

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens  / 1_000_000) * COST_PER_M_INPUT +
    (outputTokens / 1_000_000) * COST_PER_M_OUTPUT
  );
}

async function logUsage(
  calledFrom: string,
  inputTokens: number,
  outputTokens: number
) {
  try {
    const supabase = createAdminClient();
    await supabase.from("claude_usage").insert({
      called_from: calledFrom,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost: estimateCost(inputTokens, outputTokens),
    });
  } catch {
    // Non-fatal — don't let logging failure break the caller
  }
}

/**
 * Call Claude with retry logic (3 attempts, exponential backoff).
 */
export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024,
  calledFrom = "unknown"
): Promise<ClaudeResponse> {
  const MAX_ATTEMPTS = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const inputTokens  = message.usage.input_tokens;
      const outputTokens = message.usage.output_tokens;

      // Fire-and-forget usage log
      logUsage(calledFrom, inputTokens, outputTokens);

      const content =
        message.content[0].type === "text" ? message.content[0].text : "";

      return { content, inputTokens, outputTokens };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_ATTEMPTS) {
        // Exponential backoff: 1s, 2s
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError ?? new Error("Claude API call failed after 3 attempts");
}

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
