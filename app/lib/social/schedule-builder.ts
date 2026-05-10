import { createAdminClient } from "@/app/lib/supabase-server";
import type { SanityArticle } from "@/app/lib/queries";

type Platform = "linkedin" | "twitter" | "instagram";

interface TimeSlot {
  utcHour: number;
  utcMinute: number;
  label: string;
  optional?: boolean;
  pillarPreference?: string;
}

const DAILY_SCHEDULE: Record<Platform, TimeSlot[]> = {
  linkedin: [
    { utcHour: 8,  utcMinute: 30, label: "morning" },
    { utcHour: 17, utcMinute: 0,  label: "afternoon", optional: true },
  ],
  twitter: [
    { utcHour: 9,  utcMinute: 0,  label: "morning", pillarPreference: "markets-floor" },
    { utcHour: 13, utcMinute: 0,  label: "midday",   pillarPreference: "water-cooler" },
    { utcHour: 17, utcMinute: 30, label: "close",    pillarPreference: "c-suite-circus" },
  ],
  instagram: [
    { utcHour: 12, utcMinute: 0,  label: "noon" },
  ],
};

// Pillar shareability scores.
// satiricalScore from news_feed has no reliable FK to Sanity articles,
// so scoring is pillar-only. Callers can enrich articles before passing in.
const PILLAR_SCORES: Record<string, number> = {
  "water-cooler":   3,
  "c-suite-circus": 2,
  "markets-floor":  2,
  "global-office":  1,
  "macro-mondays":  1,
};

export interface ScheduledPost {
  article: SanityArticle;
  platform: Platform;
  scheduledFor: Date;
  slot: string;
}

function scoreArticle(article: SanityArticle): number {
  const slug = article.pillar?.slug?.current ?? "";
  return PILLAR_SCORES[slug] ?? 0;
}

function slotTime(date: Date, utcHour: number, utcMinute: number): Date {
  const t = new Date(date);
  t.setUTCHours(utcHour, utcMinute, 0, 0);
  return t;
}

export function buildDaySchedule(
  articles: SanityArticle[],
  date: Date
): ScheduledPost[] {
  const now = new Date();

  const scored = [...articles]
    .map((article) => ({ article, score: scoreArticle(article) }))
    .sort((a, b) => b.score - a.score);

  const posts: ScheduledPost[] = [];
  const usedLinkedIn = new Set<string>();
  const usedTwitter  = new Set<string>();
  const usedInstagram = new Set<string>();

  function tryAssign(
    article: SanityArticle,
    platform: Platform,
    slot: TimeSlot
  ): boolean {
    const scheduledFor = slotTime(date, slot.utcHour, slot.utcMinute);
    if (scheduledFor <= now) return false;
    posts.push({ article, platform, scheduledFor, slot: slot.label });
    return true;
  }

  // b. LinkedIn morning — best scoring article overall
  for (const { article } of scored) {
    if (tryAssign(article, "linkedin", DAILY_SCHEDULE.linkedin[0])) {
      usedLinkedIn.add(article._id);
      break;
    }
  }

  // c. Twitter slots — pillar preference first, then next highest unused
  for (const slot of DAILY_SCHEDULE.twitter) {
    let assigned = false;

    if (slot.pillarPreference) {
      for (const { article } of scored) {
        if (
          !usedTwitter.has(article._id) &&
          article.pillar?.slug?.current === slot.pillarPreference
        ) {
          if (tryAssign(article, "twitter", slot)) {
            usedTwitter.add(article._id);
            assigned = true;
            break;
          }
        }
      }
    }

    if (!assigned) {
      for (const { article } of scored) {
        if (!usedTwitter.has(article._id)) {
          if (tryAssign(article, "twitter", slot)) {
            usedTwitter.add(article._id);
            break;
          }
        }
      }
    }
  }

  // d. Instagram noon — best article that has an image
  for (const { article } of scored) {
    if (!usedInstagram.has(article._id) && article.heroImageUrl) {
      if (tryAssign(article, "instagram", DAILY_SCHEDULE.instagram[0])) {
        usedInstagram.add(article._id);
        break;
      }
    }
  }

  // e. LinkedIn afternoon (optional) — 4+ articles, use next highest unposted article
  if (articles.length >= 4) {
    for (const { article } of scored) {
      if (!usedLinkedIn.has(article._id)) {
        if (tryAssign(article, "linkedin", DAILY_SCHEDULE.linkedin[1])) {
          usedLinkedIn.add(article._id);
        }
        break;
      }
    }
  }

  return posts;
}

export async function checkDuplicates(
  posts: ScheduledPost[]
): Promise<ScheduledPost[]> {
  if (posts.length === 0) return [];

  const supabase = createAdminClient();
  const articleIds = [...new Set(posts.map((p) => p.article._id))];

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("social_queue")
    .select("article_id, platform")
    .in("article_id", articleIds)
    .in("status", ["pending_approval", "pending", "sent"])
    .gte("created_at", todayStart.toISOString());

  if (!data || data.length === 0) return posts;

  const alreadyQueued = new Set(
    (data as { article_id: string; platform: string }[]).map(
      (row) => `${row.article_id}::${row.platform}`
    )
  );

  return posts.filter(
    (p) => !alreadyQueued.has(`${p.article._id}::${p.platform}`)
  );
}
