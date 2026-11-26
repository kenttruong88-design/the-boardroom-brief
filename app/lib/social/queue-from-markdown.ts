import { createAdminClient } from "@/app/lib/supabase-server";
import { nextSlot, PILLAR_PLATFORMS } from "./queue-social-posts";

// Captions are written by the newsroom scheduled tasks into each article's
// frontmatter (linkedin_caption / linkedin_hashtags / instagram_caption /
// instagram_hashtags) — no API credit. Shared by every publish cron so the
// pillars queue social posts the same way and skips are never silent.

export type SocialPlatform = "linkedin" | "instagram";
export interface SocialCaptions {
  linkedin?:  { caption: string; hashtags: string[] };
  instagram?: { caption: string; hashtags: string[] };
  /** 1-10 self-rating the newsroom task writes as `social_score`; the publish cron posts the highest first. */
  score?: number;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function list(v: unknown): string[] {
  return str(v).split(",").map((x) => x.trim()).filter(Boolean);
}

// The cron frontmatter parsers are line-based (no YAML block scalars), so a long,
// multi-paragraph LinkedIn caption is written on ONE line, with a literal backslash-n
// (two characters) between paragraphs. Turn those into real line breaks.
function unescapeCaption(v: string): string {
  return v
    .replace(/\\n/g, "\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHash(tag: string): string {
  return tag.replace(/^#+/, "").replace(/\s+/g, "");
}

export function parseSocialCaptions(fm: Record<string, unknown>): SocialCaptions {
  const raw = Number.parseFloat(str(fm.social_score));
  const score = Number.isFinite(raw) ? Math.min(10, Math.max(1, Math.round(raw))) : undefined;
  return {
    ...(score !== undefined && { score }),
    ...(str(fm.linkedin_caption)  && { linkedin:  { caption: unescapeCaption(str(fm.linkedin_caption)),  hashtags: list(fm.linkedin_hashtags).map(stripHash) } }),
    ...(str(fm.instagram_caption) && { instagram: { caption: str(fm.instagram_caption), hashtags: list(fm.instagram_hashtags).map(stripHash) } }),
  };
}

export interface QueueFromMarkdownInput {
  pillarId: string;
  docId: string;
  slug: string;
  title: string;
  articleUrl: string;
  heroImageUrl: string;
  social: SocialCaptions;
}

export interface SocialSkip {
  platform: SocialPlatform;
  reason: "no-caption" | "no-image" | "already-queued" | "insert-failed";
}

// Rows enter social_queue as pending_approval, so nothing posts unreviewed.
// Every platform the pillar routes to that does NOT get a row is logged with
// the reason — previously a missing caption or image skipped without a trace.
export function instagramCaption(caption: string, pillarId: string): string {
  const base = caption.replace(/\s*Full article\s*[—-]\s*link in bio\.?\s*$/i, "").trim();
  return `${base}\n\n🔗 Latest stories: link in bio (thealignmenttimes.com/articles)`;
}

export async function queueSocialFromMarkdown(input: QueueFromMarkdownInput): Promise<{ queued: SocialPlatform[]; skipped: SocialSkip[] }> {
  const { pillarId, docId, slug, title, articleUrl, heroImageUrl, social } = input;
  const platforms = (PILLAR_PLATFORMS[pillarId] ?? []).filter(
    (p): p is SocialPlatform => p === "linkedin" || p === "instagram"
  );
  const supabase = createAdminClient();
  const now = new Date();
  const queued: SocialPlatform[] = [];
  const skipped: SocialSkip[] = [];

  const skip = (platform: SocialPlatform, reason: SocialSkip["reason"], detail?: string) => {
    skipped.push({ platform, reason });
    if (reason !== "already-queued") {
      console.warn(`[social-queue] ${pillarId}/${slug}: ${platform} not queued (${reason}${detail ? `: ${detail}` : ""})`);
    }
  };

  for (const platform of platforms) {
    const post = social[platform];
    if (!post) { skip(platform, "no-caption", `no ${platform}_caption in frontmatter`); continue; }
    if (platform === "instagram" && !heroImageUrl) { skip(platform, "no-image", "Instagram needs an image"); continue; }

    const { count } = await supabase.from("social_queue").select("*", { count: "exact", head: true })
      .eq("article_id", docId).eq("platform", platform);
    if (count) { skip(platform, "already-queued"); continue; }

    const { error } = await supabase.from("social_queue").insert({
      article_id:       docId,
      article_slug:     slug,
      article_headline: title,
      article_url:      articleUrl,
      pillar:           pillarId,
      status:           "pending_approval",
      generated_by:     "auto", // social_queue_generated_by_check allows only auto|manual
      platform,
      // Instagram captions can't hold clickable links, so no article URL. Point to the bio link
      // (set to /articles, all pillars) in plain text instead.
      content:          platform === "instagram" ? instagramCaption(post.caption, pillarId) : `${post.caption}\n\n${articleUrl}`,
      hashtags:         post.hashtags,
      image_url:        heroImageUrl || null,
      scheduled_for:    nextSlot(platform, now).toISOString(),
      review_score:     social.score ?? null,
    });
    if (error) { skip(platform, "insert-failed", error.message); continue; }
    queued.push(platform);
  }
  return { queued, skipped };
}
