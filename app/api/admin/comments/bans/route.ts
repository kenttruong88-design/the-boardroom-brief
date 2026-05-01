import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";

// GET /api/admin/comments/bans
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("comment_bans")
    .select("id, ip_hash, email, reason, banned_by, created_at, expires_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bans: data ?? [] });
}
