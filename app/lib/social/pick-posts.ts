// Picks which due social posts go to Buffer, given what is left of the daily cap.
//
// Rules, in order:
//  1. Guarantee: each pillar in GUARANTEED_PILLARS gets at least one post per day
//     (Global Office -> LinkedIn, Out of Office -> Instagram — each pillar routes to a
//     single platform). If it hasn't posted yet today and has a due post, its best-rated
//     due post goes first.
//  2. Hold: if a guaranteed pillar hasn't posted and has no due post now but has one
//     scheduled later today, keep a cap slot free for it, so the cap can't be used up
//     before its post becomes due.
//  3. The remaining room is filled by rating, highest first.

export const GUARANTEED_PILLARS = ["global-office", "out-of-office"] as const;

export interface Pickable {
  id: string;
  pillar: string | null;
  review_score: number | null;
  scheduled_for: string;
}

// Highest rating first; unrated last; ties go to the earliest slot.
export function byRating(a: Pickable, b: Pickable): number {
  return (b.review_score ?? -1) - (a.review_score ?? -1) || a.scheduled_for.localeCompare(b.scheduled_for);
}

export function pickPosts<T extends Pickable>(
  due: T[],
  remaining: number,
  sentTodayPillars: Set<string>,
  laterTodayPillars: Set<string>
): T[] {
  const picks: T[] = [];

  for (const pillar of GUARANTEED_PILLARS) {
    if (picks.length >= remaining) break;
    if (sentTodayPillars.has(pillar)) continue;
    const best = due.filter((p) => p.pillar === pillar).sort(byRating)[0];
    if (best) picks.push(best);
  }

  const held = GUARANTEED_PILLARS.filter(
    (pillar) =>
      !sentTodayPillars.has(pillar) &&
      !picks.some((p) => p.pillar === pillar) &&
      laterTodayPillars.has(pillar)
  ).length;

  const room = Math.max(0, remaining - picks.length - held);
  const rest = due.filter((p) => !picks.includes(p)).sort(byRating).slice(0, room);
  return [...picks, ...rest];
}
