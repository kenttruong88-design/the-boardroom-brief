import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";

// POST /api/admin/comments/bulk-approve
// Body: { minScore: number }
// Approves all 'pending' comments whose overall score >= minScore

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as { minScore?: number };
  const minScore = typeof body.minScore === "number" ? body.minScore : 7.5;

  const supabase = createAdminClient();

  // Fetch all pending comments with mod scores
  const { data: pending, error } = await supabase
    .from("comments")
    .select("id, mod_spam, mod_toxicity, mod_relevance")
    .eq("status", "pending")
    .is("deleted_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type PendingRow = { id: string; mod_spam: number | null; mod_toxicity: number | null; mod_relevance: number | null };
  const toApprove = ((pending ?? []) as PendingRow[])
    .filter((row) => {
      const spam = row.mod_spam ?? 0;
      const toxicity = row.mod_toxicity ?? 0;
      const relevance = row.mod_relevance ?? 5;
      const overall =
        relevance * 0.4 + (10 - spam) * 0.3 + (10 - toxicity) * 0.3;
      return overall >= minScore;
    })
    .map((row) => row.id);

  if (toApprove.length === 0) {
    return NextResponse.json({ approved: 0 });
  }

  const { error: updateError } = await supabase
    .from("comments")
    .update({ status: "approved" })
    .in("id", toApprove);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ approved: toApprove.length });
}
