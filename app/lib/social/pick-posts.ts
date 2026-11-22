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

/**
 * Spreads a platform's approved posts over days, same rules as pickPosts: per-platform cap,
 * guaranteed pillars first, best-rated next. Returns post id -> day offset (0 = today).
 * `committedToday` is what the platform already has sent/queued for today, in total and per pillar.
 */
export function planDays<T extends Pickable>(
  posts: T[],
  platform: string,
  committedToday: { total: number; byPillar: Record<string, number> }
): Map<string, number> {
  const plan = new Map<string, number>();
  const cap = capFor(platform);
  let left = [...posts].sort(byRating);
  for (let day = 0; left.length > 0 && day < 366; day++) {
    let room = Math.max(0, cap - (day === 0 ? committedToday.total : 0));
    const take: T[] = [];
    for (const g of GUARANTEES.filter((x) => x.platform === platform)) {
      const need = Math.max(0, g.min - (day === 0 ? committedToday.byPillar[g.pillar] ?? 0 : 0));
      take.push(...left.filter((p) => p.pillar === g.pillar).slice(0, Math.min(need, room - take.length)));
    }
    take.push(...left.filter((p) => !take.includes(p)).slice(0, Math.max(0, room - take.length)));
    for (const p of take) plan.set(p.id, day);
    left = left.filter((p) => !take.includes(p));
  }
  return plan;
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
