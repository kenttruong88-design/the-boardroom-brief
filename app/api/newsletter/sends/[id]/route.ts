import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: send, error } = await supabase
    .from("newsletter_sends")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !send) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Hourly open distribution from send log
  const { data: openRows } = await supabase
    .from("newsletter_send_log")
    .select("opened_at")
    .eq("send_id", id)
    .not("opened_at", "is", null);

  const hourBuckets: Record<number, number> = {};
  for (const row of openRows ?? []) {
    if (!row.opened_at) continue;
    const hour = new Date(row.opened_at as string).getUTCHours();
    hourBuckets[hour] = (hourBuckets[hour] ?? 0) + 1;
  }

  const opensByHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    opens: hourBuckets[h] ?? 0,
  }));

  return NextResponse.json({
    send,
    opensByHour,
    articlesIncluded: (send as { articles_included?: string[] }).articles_included ?? [],
  });
}
