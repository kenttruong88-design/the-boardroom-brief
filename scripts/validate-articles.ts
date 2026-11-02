/**
 * Backfill check: runs the QA validator over every .md/.mdx file in a folder.
 *
 *   npx tsx scripts/validate-articles.ts <articles-dir>            # rules 1–4, 7–9
 *   npx tsx scripts/validate-articles.ts <articles-dir> --strict   # also require <name>.checks.json + <name>.editor.json
 *
 * Exits 1 if any article fails, so it can gate a scheduled task.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import {
  validateArticle,
  formatFailures,
  type ChecksReport,
  type EditorReport,
} from "../app/lib/qa/validate-article";

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith(".md") || p.endsWith(".mdx") ? [p] : [];
  });
}

const dir = process.argv[2];
const strict = process.argv.includes("--strict");
if (!dir) {
  console.error("Usage: npx tsx scripts/validate-articles.ts <articles-dir> [--strict]");
  process.exit(2);
}

const files = walk(dir);
let failed = 0;
for (const file of files) {
  const stem = file.replace(/\.mdx?$/, "");
  const result = validateArticle({
    markdown: readFileSync(file, "utf8"),
    checks: readJson<ChecksReport>(`${stem}.checks.json`),
    editor: readJson<EditorReport>(`${stem}.editor.json`),
    requireReports: strict,
  });
  if (!result.ok) {
    failed++;
    console.log(`${basename(file)}\n${formatFailures(result)}\n`);
  }
}
console.log(
  `${files.length - failed}/${files.length} passed${strict ? " (strict)" : " (backfill: reports not required)"}`,
);
process.exit(failed ? 1 : 0);
