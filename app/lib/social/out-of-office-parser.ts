// Parses a raw content/out-of-office/*.md source file into the structured
// fields the UGC script writer needs. Heading style for the Do's & Don'ts
// section varies between batches ("## Do's & Don'ts: South Korea" x2, vs one
// "## Do's & Don'ts" heading followed by "**Croatia**" / "**Vietnam**"), so
// rather than parsing headings we pull the two Do/Don't markdown tables in
// document order and pair them positionally with the two countries listed in
// frontmatter — that ordering holds across every batch checked.

export interface CountryDosDonts {
  country: string;
  items:   Array<{ do: string; dont: string }>;
}

export interface ParsedOutOfOfficeArticle {
  headline:  string;
  countries: [string, string];
  dosDonts:  [CountryDosDonts, CountryDosDonts];
}

function extractFrontmatterCountries(markdown: string): [string, string] {
  const match = markdown.match(/^countries:\s*(.+)$/m);
  if (!match) throw new Error("No `countries:` field found in frontmatter");
  const countries = match[1].split(",").map((c) => c.trim()).filter(Boolean);
  if (countries.length !== 2) {
    throw new Error(`Expected exactly 2 countries, got ${countries.length}: ${match[1]}`);
  }
  return [countries[0], countries[1]];
}

function extractHeadline(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (!match) throw new Error("No H1 headline found");
  return match[1].trim();
}

function isSeparatorRow(line: string): boolean {
  return /^\|?[\s:-]+\|[\s:|-]+\|?$/.test(line.trim());
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** Finds every Do/Don't table (header row mentions "Do" and "Don"), in document order. */
function extractDosDontsTables(markdown: string): Array<Array<{ do: string; dont: string }>> {
  const lines = markdown.split("\n");
  const tables: Array<Array<{ do: string; dont: string }>> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) continue;
    if (!/do/i.test(line) || !/don.?t/i.test(line)) continue;
    if (i + 1 >= lines.length || !isSeparatorRow(lines[i + 1])) continue;

    const rows: Array<{ do: string; dont: string }> = [];
    let j = i + 2;
    while (j < lines.length && lines[j].trim().startsWith("|")) {
      const cells = splitRow(lines[j]);
      if (cells.length >= 2 && cells[0] && cells[1]) {
        rows.push({ do: cells[0], dont: cells[1] });
      }
      j++;
    }
    if (rows.length > 0) tables.push(rows);
    i = j;
  }
  return tables;
}

export function parseOutOfOfficeArticle(markdown: string): ParsedOutOfOfficeArticle {
  const headline  = extractHeadline(markdown);
  const countries = extractFrontmatterCountries(markdown);
  const tables    = extractDosDontsTables(markdown);

  if (tables.length < 2) {
    throw new Error(`Expected 2 Do's & Don'ts tables, found ${tables.length}`);
  }

  return {
    headline,
    countries,
    dosDonts: [
      { country: countries[0], items: tables[0] },
      { country: countries[1], items: tables[1] },
    ],
  };
}
