// Gate for posting without a human click. A post that passes is queued as "pending"
// (the publish cron sends it); one that fails stays "pending_approval" for review.
//
// Kill switch: set SOCIAL_AUTO_APPROVE=off in the environment and every post is held
// for approval again. Threshold: SOCIAL_AUTO_APPROVE_MIN_SCORE (default 7, of 10).

export const DEFAULT_MIN_SCORE = 7;

const LIMITS = {
  linkedin:  { min: 300, max: 2800, minHashtags: 3 },
  instagram: { min: 40,  max: 1900, minHashtags: 3 },
} as const;

// Market figures the newsroom rules forbid: prices, percentages, basis points.
const MARKET_NUMBER = /\$\s?\d|€\s?\d|£\s?\d|\d(?:[.,]\d+)?\s?%|\bbasis points?\b|\bbps\b/i;

export interface AutoApproveInput {
  platform: "linkedin" | "instagram";
  /** The caption as written by the newsroom (before the link / bio line is added). */
  caption: string;
  hashtags: string[];
  score: number | undefined;
  /** First 80 chars of recently queued captions on this platform, lower-cased. */
  recentHooks: string[];
  env?: { SOCIAL_AUTO_APPROVE?: string; SOCIAL_AUTO_APPROVE_MIN_SCORE?: string };
}

export function hookKey(caption: string): string {
  return caption.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 80);
}

/** Returns the reasons a post must be held for review; an empty list means it may auto-approve. */
export function holdReasons(i: AutoApproveInput): string[] {
  const env = i.env ?? (typeof process !== "undefined" ? process.env : {});
  if ((env.SOCIAL_AUTO_APPROVE ?? "").toLowerCase() === "off") return ["auto-approve is switched off"];

  const reasons: string[] = [];
  const minScore = Number.parseFloat(env.SOCIAL_AUTO_APPROVE_MIN_SCORE ?? "") || DEFAULT_MIN_SCORE;
  if (i.score === undefined) reasons.push("no social_score");
  else if (i.score < minScore) reasons.push(`score ${i.score} < ${minScore}`);

  const lim = LIMITS[i.platform];
  const len = i.caption.trim().length;
  if (len < lim.min) reasons.push(`caption too short (${len} < ${lim.min})`);
  if (len > lim.max) reasons.push(`caption too long (${len} > ${lim.max})`);
  if (i.hashtags.length < lim.minHashtags) reasons.push(`only ${i.hashtags.length} hashtags`);
  if (MARKET_NUMBER.test(i.caption)) reasons.push("contains a market number");
  if (/\\n/.test(i.caption) || /\bundefined\b|\bnull\b|\[object /i.test(i.caption)) reasons.push("caption looks malformed");
  if (i.recentHooks.includes(hookKey(i.caption))) reasons.push("duplicate of a recent post");
  return reasons;
}
