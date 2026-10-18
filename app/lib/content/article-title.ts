// Shared by the Global Office and Out of Office publish crons.
//
// Content is normally authored with an H1 title (`# Title`), but generated
// batches drift: some emit the title as an H2/H3, a bold line (`**Title**`),
// a "[HEADLINE]" tagged line (bold or not), or a bare first line. Until
// 2026-10-18 anything but H1/bold fell back to the raw filename, so 33
// Global Office articles went live headlined "2026 07 23_03_canada vs ...".

const HEADLINE_TAG = /^(?:\*\*)?\[HEADLINE\](?:\*\*)?\s*/i;

/** The pre-2026-10-18 filename fallback title, kept only so already-published slugs can still be recognised. */
export function legacyFilenameTitle(filePath: string): string {
  return filePath.split(/[/\\]/).pop()!.replace(/\.md$/i, "").replace(/-/g, " ");
}

/** A readable title from the filename, without the "2026-10-18_01_" date/number prefix. */
function filenameTitle(filePath: string): string {
  return filePath.split(/[/\\]/).pop()!
    .replace(/\.md$/i, "")
    .replace(/^\d{4}-\d{2}-\d{2}_\d+_/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

export function extractTitle(bodyMd: string, filePath: string): { title: string; noTitle: string } {
  const h1 = bodyMd.match(/^#\s+(.+)$/m);
  if (h1) {
    return { title: h1[1].trim(), noTitle: bodyMd.replace(/^#\s+.+\n*/m, "").trim() };
  }

  const lines = bodyMd.split("\n");
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  const firstLine = firstIdx >= 0 ? lines[firstIdx].trim() : "";
  const nextLine = lines[firstIdx + 1]?.trim() ?? "";

  const heading = firstLine.match(/^#{2,6}\s+(.+)$/);
  const tagged = HEADLINE_TAG.test(firstLine);
  const bold = firstLine.match(/^\*\*(.+?)\*\*$/);
  // A short standalone first line (its own paragraph) that isn't an image,
  // table, quote, rule or flag/byline line is the headline.
  const bare = !nextLine && firstLine.length <= 200 && !/^(?:!\[|\||>|-{3,}|\*By\s|By\s|[\u{1F1E6}-\u{1F1FF}])/u.test(firstLine);

  if (heading || tagged || bold || bare) {
    const title = (heading ? heading[1] : firstLine)
      .replace(HEADLINE_TAG, "")
      .replace(/^\*\*(.+?)\*\*$/, "$1")
      .trim();
    if (title) {
      const rest = [...lines.slice(0, firstIdx), ...lines.slice(firstIdx + 1)].join("\n");
      return { title, noTitle: rest.trim() };
    }
  }

  return { title: filenameTitle(filePath), noTitle: bodyMd };
}
