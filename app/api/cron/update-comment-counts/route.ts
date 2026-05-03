import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";

// GET /api/cron/update-comment-counts
// Runs nightly via Vercel cron. Calls the SQL function that refreshes
// article_comment_counts — used for "Most discussed" engagement sorting.

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase.rpc("refresh_article_comment_counts");

  if (error) {
    console.error("[cron/update-comment-counts] RPC failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return top 10 most-discussed for the log
  const { data: top } = await supabase
    .from("article_comment_counts")
    .select("article_id, count")
    .order("count", { ascending: false })
    .limit(10);

  return NextResponse.json({ ok: true, refreshed: new Date().toISOString(), top: top ?? [] });
}
