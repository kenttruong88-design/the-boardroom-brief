// Picks which due social posts go to Buffer, applying a daily cap PER PLATFORM.
//
// Per platform, in order:
//  1. Guarantee: a pillar in GUARANTEES that has posted fewer than `min` times today
//     gets its best-rated due posts first, up to what it still needs (Global Office ->
//     LinkedIn, Out of Office -> Instagram).
//  2. Hold: if a guaranteed pillar is still short and has more posts scheduled later
//     today but not due yet, keep that many cap slots free for it, so the cap can't be
//     used up before those posts become due.
//  3. The remaining room is filled by rating, highest first.
//
// Buffer's own limits are 50 posts per 24h on both LinkedIn and Instagram; these caps
// are deliberately lower so the feeds don't feel spammy.

export const PLATFORM_CAPS: Record<string, number> = { linkedin: 5, instagram: 3 };
export const DEFAULT_PLATFORM_CAP = 3;

export const GUARANTEES = [
  { pillar: "global-office", platform: "linkedin",  min: 2 },
  { pillar: "out-of-office", platform: "instagram", min: 2 },
] as const;

// Minutes between consecutive posts on one platform sent in the same cron run.
export const POST_SPACING_MINUTES: Record<string, number> = { linkedin: 90, instagram: 120 };

export const GUARANTEED_PILLARS: string[] = GUARANTEES.map((g) => g.pillar);

export function capFor(platform: string): number {
  return PLATFORM_CAPS[platform] ?? DEFAULT_PLATFORM_CAP;
}

export interface Pickable {
  id: string;
  platform: string;
  pillar: string | null;
  review_score: number | null;
  scheduled_for: string;
}

export interface SentToday {
  platform: string;
  pillar: string | null;
}

// Highest rating first; unrated last; ties go to the earliest slot.
export function byRating(a: Pickable, b: Pickable): number {
  return (b.review_score ?? -1) - (a.review_score ?? -1) || a.scheduled_for.localeCompare(b.scheduled_for);
}

export function pickPosts<T extends Pickable>(
  due: T[],
  sentToday: SentToday[],
  /** pillar -> number of its pending posts scheduled later today (not due yet) */
  laterToday: Record<string, number>
): T[] {
  const result: T[] = [];

  for (const platform of new Set(due.map((p) => p.platform))) {
    const platformDue = due.filter((p) => p.platform === platform);
    const remaining = capFor(platform) - sentToday.filter((s) => s.platform === platform).length;
    if (remaining <= 0) continue;

    const picks: T[] = [];
    let held = 0;
    for (const g of GUARANTEES.filter((x) => x.platform === platform)) {
      const need = Math.max(
        0,
        g.min - sentToday.filter((s) => s.platform === platform && s.pillar === g.pillar).length
      );
      if (need === 0) continue;
      const take = platformDue
        .filter((p) => p.pillar === g.pillar)
        .sort(byRating)
        .slice(0, Math.max(0, Math.min(need, remaining - picks.length)));
      picks.push(...take);
      held += Math.min(need - take.length, laterToday[g.pillar] ?? 0);
    }

    const room = Math.max(0, remaining - picks.length - held);
    const rest = platformDue.filter((p) => !picks.includes(p)).sort(byRating).slice(0, room);
    result.push(...picks, ...rest);
  }

  return result.sort(byRating);
}
