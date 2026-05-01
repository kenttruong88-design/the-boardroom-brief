import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";

// DELETE /api/admin/comments/bans/[banId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ banId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { banId } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("comment_bans")
    .delete()
    .eq("id", banId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
