import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";
import { scheduledForApproval } from "@/app/lib/social/approval-schedule";

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();
  const now = new Date();

  const { data: rows, error: fetchError } = await supabase
    .from("social_queue")
    .select("id, platform, scheduled_for")
    .eq("status", "pending_approval");

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  // Approving after the original slot has passed would leave the post outside the
  // publish cron's lookback window forever, so move stale slots to the next one.
  let approved = 0;
  let rescheduled = 0;
  const failures: string[] = [];
  const pending = rows ?? [];
  for (let i = 0; i < pending.length; i += 25) {
    const results = await Promise.all(
      pending.slice(i, i + 25).map(async (row) => {
        const next = scheduledForApproval(row.platform as string, row.scheduled_for as string | null, now);
        const moved = next !== row.scheduled_for;
        const { data, error } = await supabase
          .from("social_queue")
          .update({ status: "pending", ...(moved && next ? { scheduled_for: next } : {}) })
          .eq("id", row.id)
          .eq("status", "pending_approval") // never overwrite a row changed since the select
          .select("id");
        if (error) { failures.push(`${row.id}: ${error.message}`); return { ok: false, moved: false }; }
        return { ok: (data?.length ?? 0) > 0, moved: moved && (data?.length ?? 0) > 0 };
      })
    );
    approved += results.filter((r) => r.ok).length;
    rescheduled += results.filter((r) => r.moved).length;
  }

  return NextResponse.json({ approved, rescheduled, ...(failures.length ? { failures } : {}) });
}
