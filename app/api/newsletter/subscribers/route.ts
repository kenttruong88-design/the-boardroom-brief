import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { requireAuth } from "@/app/api/editorial/_helpers";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "all";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const supabase = createAdminClient();

  let query = supabase
    .from("subscribers")
    .select(
      "id, email, first_name, status, confirmed_at, created_at, emails_sent, emails_opened, emails_clicked, source",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== "all") query = query.eq("status", status);

  const [{ data, error, count }, { data: allStatuses }] = await Promise.all([
    query,
    supabase.from("subscribers").select("status"),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (allStatuses ?? []) as { status: string }[];
  const counts = {
    pending:      rows.filter((r) => r.status === "pending").length,
    confirmed:    rows.filter((r) => r.status === "confirmed").length,
    unsubscribed: rows.filter((r) => r.status === "unsubscribed").length,
    bounced:      rows.filter((r) => r.status === "bounced").length,
    total:        rows.length,
  };

  return NextResponse.json({ subscribers: data ?? [], total: count ?? 0, page, limit, counts });
}
