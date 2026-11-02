/**
 * validate-article.ts — The Alignment Times QA assembler (deterministic, no LLM).
 *
 * Every rule must pass or the article is stopped. Agents judge; this file verifies.
 *
 * Usage as a library:
 *   import { validateArticle } from "@/app/lib/qa/validate-article";
 *   const result = validateArticle({ markdown, checks, editor });
 *   if (!result.ok) { log(result.failures); stop(); }
 *
 * CLI (backfill check over existing articles): see scripts/validate-articles.ts
 *
 * Requires: gray-matter  (npm install gray-matter)
 */

import matter from "gray-matter";
import { extractTitle } from "@/app/lib/content/article-title";

// ---------------------------------------------------------------------------
// Config — adjust to your repo
// ---------------------------------------------------------------------------

/**
 * Pillar → persona. Rule 3. The content/ markdown batches use the display
 * names ("The Global Office", "Out of Office"); the newsroom pillars and a few
 * stray articles use Sanity slugs, so both spellings are listed.
 */
export const PERSONA_BY_PILLAR: Record<string, string> = {
  "markets-floor": "Rex Volkov",
  "macro-mondays": "Ingrid Holt",
  "c-suite-circus": "Miles Bancroft",
  "global-office": "Priya Mehta",
  "The Global Office": "Priya Mehta",
  "out-of-office": "Suki Nakamura",
  "Out of Office": "Suki Nakamura",
  "water-cooler": "Danny Fisk",
};

/**
 * Field names as the scheduled-task batches write them (dotted = nested).
 * There is no title/slug/publishedAt in frontmatter: the publish crons take the
 * title from the body's headline line (extractTitle), the slug from the title,
 * and the publish date from `date`.
 */
export const REQUIRED_FRONTMATTER = [
  "pillar",
  "author",
  "date",
  "countries",
  "subject",
  "images.hero",
  "images.hero_source",
] as const;

/** Rule 7 — set to your real article lengths. */
export const WORD_RANGE = { min: 400, max: 1400 };
export const MAX_HEADLINE_CHARS = 90;

/** Rule 4 — allowed image hosts. */
const IMAGE_URL_PATTERNS = [
  /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i,
  /^https:\/\/images\.pexels\.com\//i,
];

/** Frontmatter keys that hold image URLs (checked by rule 4 when present). */
const IMAGE_FIELDS = ["images.hero", "images.body"];

/** Reads a frontmatter field, following dots into nested maps ("images.hero"). */
function getField(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined),
    data,
  );
}

/** Same slug the publish crons derive from the title. */
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96);
}

// ---------------------------------------------------------------------------
// Report types (match the agent prompts in the build plan)
// ---------------------------------------------------------------------------

export type ClaimStatus = "verified" | "mismatch" | "unverifiable" | "satire";

export interface ChecksReport {
  article_slug: string;
  claims: Array<{
    text: string;
    type: string;
    status: ClaimStatus;
    draft_value: string | null;
    source_value: string | null;
    source: string | null;
    fix?: string | null;
  }>;
  summary: Record<ClaimStatus, number>;
}

export interface EditorReport {
  verdict: "publish" | "revise" | "hold";
  risk_flags: Array<{ text: string; reason: string }>;
  voice_score: number;
  edits: Array<{ before: string; after: string; why: string }>;
  notes_for_writer?: string;
}

export interface Failure {
  rule: number;
  name: string;
  detail: string;
  line?: number;
}

export interface ValidationResult {
  ok: boolean;
  slug: string | null;
  failures: Failure[];
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/**
 * Rule 1 — placeholders. Catches [IMAGE_1], [TODO], [TBD], {{STYLE_CARD}},
 * and any other [ALL_CAPS_TOKEN]. Markdown links like [Read more](url) are not
 * matched because the bracket text must be all-caps/digits/underscores.
 */
const PLACEHOLDER_PATTERNS: Array<[RegExp, string]> = [
  [/\[[A-Z][A-Z0-9_]*\](?!\()/g, "bracket placeholder"],
  [/\{\{[^}]*\}\}/g, "template variable"],
  [/\b(?:TODO|TBD|FIXME|XXX)\b/g, "to-do marker"],
  [/lorem ipsum/gi, "filler text"],
];

function findPlaceholders(text: string, where: string): Failure[] {
  const failures: Failure[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const [re, label] of PLACEHOLDER_PATTERNS) {
      re.lastIndex = 0;
      for (const m of line.matchAll(re)) {
        failures.push({
          rule: 1,
          name: "no-placeholders",
          detail: `${label} "${m[0]}" in ${where}`,
          line: i + 1,
        });
      }
    }
  });
  return failures;
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

function wordCount(body: string): number {
  return body
    .replace(/```[\s\S]*?```/g, " ") // code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → text
    .replace(/[#>*_`|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function validateArticle(input: {
  markdown: string;
  checks?: ChecksReport | null;
  editor?: EditorReport | null;
  /** When false, rules 5–6 are skipped (backfill mode for already-published articles). */
  requireReports?: boolean;
}): ValidationResult {
  const { markdown, checks, editor, requireReports = true } = input;
  const failures: Failure[] = [];

  let data: Record<string, unknown>;
  let body: string;
  try {
    const parsed = matter(markdown);
    data = parsed.data;
    body = parsed.content;
  } catch (e) {
    return {
      ok: false,
      slug: null,
      failures: [{ rule: 2, name: "frontmatter", detail: `Frontmatter does not parse: ${(e as Error).message}` }],
    };
  }

  // Title/slug come from the body headline, as in the publish crons. An empty
  // path makes extractTitle's filename fallback return "", i.e. no headline.
  const title = typeof data.title === "string" ? data.title : extractTitle(body, "").title || null;
  const slug = typeof data.slug === "string" ? data.slug : title ? slugify(title) : null;
  if (!title) {
    failures.push({ rule: 2, name: "required-frontmatter", detail: "No headline line found in the body (title would fall back to the filename)" });
  }

  // Rule 1 — placeholders in body and in every string frontmatter value
  failures.push(...findPlaceholders(body, "body"));
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string") failures.push(...findPlaceholders(v, `frontmatter.${k}`).map((f) => ({ ...f, line: undefined })));
  }

  // Rule 2 — required frontmatter
  for (const key of REQUIRED_FRONTMATTER) {
    if (isEmpty(getField(data, key))) {
      failures.push({ rule: 2, name: "required-frontmatter", detail: `"${key}" is missing or empty` });
    }
  }

  // Rule 3 — pillar ↔ persona
  if (typeof data.pillar === "string" && typeof data.author === "string") {
    const expected = PERSONA_BY_PILLAR[data.pillar];
    if (!expected) {
      failures.push({ rule: 3, name: "pillar-persona", detail: `Unknown pillar "${data.pillar}"` });
    } else if (data.author !== expected) {
      failures.push({
        rule: 3,
        name: "pillar-persona",
        detail: `Pillar "${data.pillar}" belongs to ${expected}, but author is "${data.author}"`,
      });
    }
  }

  // Rule 4 — image URLs (frontmatter fields + inline markdown images)
  const imageUrls: Array<[string, string]> = [];
  for (const f of IMAGE_FIELDS) {
    const url = getField(data, f);
    if (typeof url === "string" && url) imageUrls.push([`frontmatter.${f}`, url]);
  }
  for (const m of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) imageUrls.push(["body", m[1]]);
  for (const [where, url] of imageUrls) {
    if (!IMAGE_URL_PATTERNS.some((re) => re.test(url))) {
      failures.push({ rule: 4, name: "image-url", detail: `${where}: "${url}" is not an allowed Cloudinary/Pexels URL` });
    }
  }

  // Rule 5 — Data Checker report
  if (requireReports) {
    if (!checks) {
      failures.push({ rule: 5, name: "checker-passed", detail: "checks.json missing" });
    } else {
      if (slug && checks.article_slug !== slug) {
        failures.push({ rule: 5, name: "checker-passed", detail: `checks.json is for "${checks.article_slug}", not "${slug}"` });
      }
      for (const c of checks.claims) {
        if (c.status === "mismatch") {
          failures.push({
            rule: 5,
            name: "checker-passed",
            detail: `Mismatch: "${c.text}" (draft ${c.draft_value}, source ${c.source_value})`,
          });
        }
        if (c.status === "verified" && (isEmpty(c.source_value) || isEmpty(c.source))) {
          failures.push({
            rule: 5,
            name: "checker-passed",
            detail: `Claim marked verified without evidence: "${c.text}"`,
          });
        }
      }
      if (checks.claims.length === 0) {
        failures.push({ rule: 5, name: "checker-passed", detail: "checks.json has zero claims — checker likely did not run" });
      }
    }
  }

  // Rule 6 — Editor report
  if (requireReports) {
    if (!editor) {
      failures.push({ rule: 6, name: "editor-passed", detail: "editor.json missing" });
    } else {
      if (editor.verdict !== "publish") {
        failures.push({ rule: 6, name: "editor-passed", detail: `Editor verdict is "${editor.verdict}"` });
      }
      if (editor.risk_flags?.length) {
        failures.push({
          rule: 6,
          name: "editor-passed",
          detail: `${editor.risk_flags.length} risk flag(s): ${editor.risk_flags.map((f) => f.reason).join("; ")}`,
        });
      }
    }
  }

  // Rule 7 — length
  const words = wordCount(body);
  if (words < WORD_RANGE.min || words > WORD_RANGE.max) {
    failures.push({ rule: 7, name: "length", detail: `${words} words (allowed ${WORD_RANGE.min}–${WORD_RANGE.max})` });
  }

  // Rule 8 — headline
  if (title && title.length > MAX_HEADLINE_CHARS) {
    failures.push({ rule: 8, name: "headline", detail: `Title is ${title.length} chars (max ${MAX_HEADLINE_CHARS})` });
  }

  // Rule 9 — slug format (uniqueness: check against Sanity at the call site)
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    failures.push({ rule: 9, name: "slug", detail: `Slug "${slug}" is not lowercase-hyphen format` });
  }

  return { ok: failures.length === 0, slug, failures };
}

/** One-line-per-failure text for logs and the Sanity review note. */
export function formatFailures(result: ValidationResult): string {
  if (result.ok) return `PASS ${result.slug ?? "(no slug)"}`;
  return [
    `FAIL ${result.slug ?? "(no slug)"} — ${result.failures.length} issue(s)`,
    ...result.failures.map((f) => `  rule ${f.rule} ${f.name}${f.line ? ` (line ${f.line})` : ""}: ${f.detail}`),
  ].join("\n");
}
