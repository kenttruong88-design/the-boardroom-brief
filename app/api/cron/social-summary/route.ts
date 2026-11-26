import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { escapeHtml, sendSocialEmail } from "@/app/lib/social/notify";
import { PLATFORM_CAPS } from "@/app/lib/social/pick-posts";

export const maxDuration = 60;

// Daily social summary email — runs after the last publish run of the day (~18:45 UTC).

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}` || req.headers.get("x-cron-secret") === secret;
}

interface Row {
  platform: string;
  pillar: string | null;
  status: string;
  article_headline: string;
  error: string | null;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const since = dayStart.toISOString();

  const [sentRes, failedRes, heldRes, pendingRes] = await Promise.all([
    supabase.from("social_queue").select("platform, pillar, status, article_headline, error").eq("status", "sent").gte("sent_at", since),
    supabase.from("social_queue").select("platform, pillar, status, article_headline, error").eq("status", "failed").gte("created_at", new Date(dayStart.getTime() - 24 * 3600 * 1000).toISOString()),
    supabase.from("social_queue").select("platform, pillar, status, article_headline, error").eq("status", "pending_approval").limit(200),
    supabase.from("social_queue").select("platform, pillar, status, article_headline, error").eq("status", "pending").gte("scheduled_for", since).limit(200),
  ]);

  const sent = (sentRes.data ?? []) as Row[];
  const failed = (failedRes.data ?? []) as Row[];
  const held = (heldRes.data ?? []) as Row[];
  const pending = (pendingRes.data ?? []) as Row[];

  const count = (rows: Row[], key: "platform" | "pillar") => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r[key] ?? "unknown"] = (m[r[key] ?? "unknown"] ?? 0) + 1;
    return Object.entries(m).map(([k, v]) => `${escapeHtml(k)}: ${v}`).join(", ") || "none";
  };
  const li = (rows: Row[], max = 10) =>
    rows.slice(0, max).map((r) => `<li>[${escapeHtml(r.platform)}] ${escapeHtml(r.article_headline)}${r.error ? ` — ${escapeHtml(r.error)}` : ""}</li>`).join("") +
    (rows.length > max ? `<li>…and ${rows.length - max} more</li>` : "");

  const html = `
    <h2>Social summary — ${dayStart.toISOString().slice(0, 10)}</h2>
    <p><strong>Sent today:</strong> ${sent.length} (caps: LinkedIn ${PLATFORM_CAPS.linkedin}, Instagram ${PLATFORM_CAPS.instagram} per day)<br>
    By platform: ${count(sent, "platform")}<br>By pillar: ${count(sent, "pillar")}</p>
    <p><strong>Failed:</strong> ${failed.length}</p>${failed.length ? `<ul>${li(failed)}</ul>` : ""}
    <p><strong>Waiting for your review:</strong> ${held.length} (held by the auto-approve gate or queued before it existed)</p>${held.length ? `<ul>${li(held)}</ul>` : ""}
    <p><strong>Approved, still unsent:</strong> ${pending.length} (scheduled for later or over today's caps)</p>
  `.trim();

  const emailed = await sendSocialEmail(
    `Social summary: ${sent.length} sent, ${failed.length} failed, ${held.length} to review`,
    html
  );
  return NextResponse.json({ sent: sent.length, failed: failed.length, held: held.length, pending: pending.length, emailed });
}
