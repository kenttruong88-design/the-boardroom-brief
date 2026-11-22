// The text actually sent to Buffer: the stored caption followed by its hashtags.
// Every send path (publish cron, bulk publish, single publish) must use this so a post
// looks the same whichever way it goes out. Hashtags are stored without "#"; tolerate
// stored values that have one, blanks, and duplicates.
export function withHashtags(content: string, hashtags: string[] | null | undefined): string {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of hashtags ?? []) {
    const tag = String(raw).trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(`#${tag}`);
  }
  return tags.length ? `${content}\n\n${tags.join(" ")}` : content;
}
