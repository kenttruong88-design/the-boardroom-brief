import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";

export async function GET() {
  const supabase = createAdminClient();

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().split("T")[0];

  const [
    { count: totalConfirmed },
    { count: newThisWeek },
    { data: todaySend },
    { data: recentSends },
    { data: growthRaw },
  ] = await Promise.all([
    supabase
      .from("subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed"),
    supabase
      .from("subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("confirmed_at", weekAgo),
    supabase
      .from("newsletter_sends")
      .select("id, status, send_date, sent_count, open_count, click_count")
      .eq("send_date", today)
      .maybeSingle(),
    supabase
      .from("newsletter_sends")
      .select("send_date, sent_count, open_count, click_count, status")
      .eq("status", "sent")
      .order("send_date", { ascending: false })
      .limit(30),
    supabase
      .from("subscribers")
      .select("confirmed_at")
      .eq("status", "confirmed")
      .gte("confirmed_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("confirmed_at", { ascending: true }),
  ]);

  const lastSend = (recentSends ?? [])[0] ?? null;
  const lastSendOpenRate =
    lastSend && lastSend.sent_count > 0
      ? +(((lastSend.open_count / lastSend.sent_count) * 100).toFixed(1))
      : null;
  const lastSendClickRate =
    lastSend && lastSend.sent_count > 0
      ? +(((lastSend.click_count / lastSend.sent_count) * 100).toFixed(1))
      : null;

  type SendRow = { sent_count: number; open_count: number; click_count: number; send_date: string };
  const sendsWithData = ((recentSends ?? []) as SendRow[]).filter((s: SendRow) => s.sent_count > 0);
  const avgOpenRate30d =
    sendsWithData.length > 0
      ? +(
          (sendsWithData.reduce((sum: number, s: SendRow) => sum + s.open_count / s.sent_count, 0) /
            sendsWithData.length) *
          100
        ).toFixed(1)
      : null;

  // Daily new-subscriber counts → used client-side to compute cumulative
  const growthByDate: Record<string, number> = {};
  for (const row of growthRaw ?? []) {
    if (!row.confirmed_at) continue;
    const date = (row.confirmed_at as string).split("T")[0];
    growthByDate[date] = (growthByDate[date] ?? 0) + 1;
  }
  const growth = Object.entries(growthByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    totalConfirmed: totalConfirmed ?? 0,
    newThisWeek: newThisWeek ?? 0,
    todaySendStatus: (todaySend as { status?: string } | null)?.status ?? "not_sent",
    lastSendOpenRate,
    lastSendClickRate,
    lastSendDate: lastSend?.send_date ?? null,
    avgOpenRate30d,
    growth,
  });
}
