import { NextResponse } from "next/server";
import { requireAuth, loadDigest, todayDate } from "../_helpers";

// GET — returns today's digest (auth required)
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const row = await loadDigest();

  if (!row) {
    return NextResponse.json({
      status: "pending",
      message: "Pipeline not yet run today",
    });
  }

  return NextResponse.json({
    status: "ready",
    date: todayDate(),
    digest: row.digest_json,
    articlesApproved: row.articles_approved,
    articlesRejected: row.articles_rejected,
    pipelineRanAt: row.created_at,
  });
}
