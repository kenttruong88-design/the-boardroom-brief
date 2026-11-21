import { createAdminClient } from "@/app/lib/supabase-server";
import { nextSlot, PILLAR_PLATFORMS } from "./queue-social-posts";

// Captions are written by the newsroom scheduled tasks into each article's
// frontmatter (linkedin_caption / linkedin_hashtags / instagram_caption /
// instagram_hashtags) — no API credit. Shared by every publish cron so the
// pillars queue social posts the same way and skips are never silent.

export type SocialPlatform = "linkedin" | "instagram";
export type SocialCaptions = Partial<Record<SocialPlatform, { caption: string; hashtags: string[] }>>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function list(v: unknown): string[] {
  return str(v).split(",").map((x) => x.trim()).filter(Boolean);
}

function stripHash(tag: string): string {
  return tag.replace(/^#+/, "").replace(/\s+/g, "");
}

export function parseSocialCaptions(fm: Record<string, unknown>): SocialCaptions {
  return {
    ...(str(fm.linkedin_caption)  && { linkedin:  { caption: str(fm.linkedin_caption),  hashtags: list(fm.linkedin_hashtags).map(stripHash) } }),
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
      content:          `${post.caption}\n\n${articleUrl}`,
      hashtags:         post.hashtags,
      image_url:        heroImageUrl || null,
      scheduled_for:    nextSlot(platform, now).toISOString(),
    });
    if (error) { skip(platform, "insert-failed", error.message); continue; }
    queued.push(platform);
  }
  return { queued, skipped };
}
