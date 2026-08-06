import { NextResponse } from "next/server";
import { requireAuth } from "../../_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";
import type { UgcVideoQueueRow } from "@/app/lib/social/ugc-video-generator";

export const maxDuration = 30;

// GET /api/editorial/ugc/list
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ugc_video_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ videos: (data ?? []) as UgcVideoQueueRow[] });
}
