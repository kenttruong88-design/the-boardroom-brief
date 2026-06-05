import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { withCronMonitoring } from "@/app/lib/sentry-cron";

// GET /api/cron/update-comment-counts
// Runs nightly via Vercel cron. Calls the SQL function that refreshes
// article_comment_counts — used for "Most discussed" engagement sorting.

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronMonitoring(
    {
      monitorSlug: "update-comment-counts",
      schedule: "0 2 * * *",
      checkinMargin: 10,
      maxRuntime: 5,
    },
    async () => {
      const supabase = createAdminClient();

      const { error } = await supabase.rpc("refresh_article_comment_counts");

      if (error) {
        console.error("[cron/update-comment-counts] RPC failed:", error.message);
        throw new Error(error.message);
      }

      const { data: top } = await supabase
        .from("article_comment_counts")
        .select("article_id, count")
        .order("count", { ascending: false })
        .limit(10);

      return NextResponse.json({ ok: true, refreshed: new Date().toISOString(), top: top ?? [] });
    }
  );
}
