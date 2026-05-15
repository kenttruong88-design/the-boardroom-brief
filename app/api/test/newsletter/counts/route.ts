import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test routes are disabled in production" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("subscribers")
    .select("status");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as { status: string }[];
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return NextResponse.json({
    pending:      count("pending"),
    confirmed:    count("confirmed"),
    unsubscribed: count("unsubscribed"),
    bounced:      count("bounced"),
    total:        rows.length,
  });
}
