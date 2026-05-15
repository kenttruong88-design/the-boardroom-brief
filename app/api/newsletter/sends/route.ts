import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "30", 10));
  const offset = (page - 1) * limit;

  const supabase = createAdminClient();

  const { data, error, count } = await supabase
    .from("newsletter_sends")
    .select("*", { count: "exact" })
    .order("send_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sends: data ?? [], total: count ?? 0, page, limit });
}
