import { nextSlot } from "./queue-social-posts";

type Platform = "linkedin" | "twitter" | "instagram";

// A post's scheduled_for is fixed when its row is created. If the post is approved
// after that slot has passed, the publish cron's 24h lookback never sees it and it
// sits in "pending" forever. Approval therefore moves a past slot to the platform's
// next slot; a future slot (or one the user deliberately set) is left alone.
export function scheduledForApproval(
  platform: string,
  scheduledFor: string | null | undefined,
  now: Date = new Date()
): string | null {
  const when = scheduledFor ? new Date(scheduledFor) : null;
  if (when && !Number.isNaN(when.getTime()) && when > now) return scheduledFor ?? null;
  if (platform !== "linkedin" && platform !== "twitter" && platform !== "instagram") return scheduledFor ?? null;
  return nextSlot(platform as Platform, now).toISOString();
}
