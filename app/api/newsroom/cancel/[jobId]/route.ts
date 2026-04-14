import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { requireAuth } from "@/app/api/editorial/_helpers";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { jobId } = await params;
  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from("pipeline_jobs")
    .select("status")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status !== "running" && job.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot cancel job with status: ${job.status}` },
      { status: 400 }
    );
  }

  await supabase
    .from("pipeline_jobs")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", jobId);

  return NextResponse.json({ success: true, jobId, status: "cancelled" });
}
