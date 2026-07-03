import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { assembleMorningBrief } from "@/app/lib/newsletter/content-assembler";
import { sendMorningBrief } from "@/app/lib/newsletter/sender";
import { withCronMonitoring } from "@/app/lib/sentry-cron";

export const maxDuration = 300;

function isAuthorized(req: Request): boolean {
  const secret =
    req.headers.get("x-newsletter-secret") ??
    req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return withCronMonitoring(
    {
      monitorSlug: "newsletter-morning-brief",
      schedule: "30 7 * * *",
      checkinMargin: 10,
      maxRuntime: 30,
    },
    () => runSend(req)
  );
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSend(req);
}

async function runSend(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";
  const dateParam = searchParams.get("date"); // YYYY-MM-DD

  const sendDate = dateParam ?? new Date().toISOString().split("T")[0];
  const targetDate = dateParam ? new Date(`${dateParam}T07:00:00Z`) : new Date();

  const supabase = createAdminClient();
  const startedAt = new Date();

  // ── a. Idempotency check ─────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("newsletter_sends")
    .select("id, status")
    .eq("send_date", sendDate)
    .single();

  if (existing?.status === "sent" && !force) {
    return NextResponse.json({ message: "Already sent today", sendDate });
  }

  // ── b. Upsert newsletter_sends row as 'pending' ─────────────────────────
  let sendId: string;

  if (existing) {
    sendId = existing.id as string;
    const { error: resetError } = await supabase
      .from("newsletter_sends")
      .update({ status: "pending", error: null, started_at: startedAt.toISOString() })
      .eq("id", sendId);
    if (resetError) console.error("[newsletter/send] Failed to reset send row to pending:", resetError.message);
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("newsletter_sends")
      .insert({ send_date: sendDate, status: "pending", started_at: startedAt.toISOString() })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json({ error: "Failed to create send record" }, { status: 500 });
    }
    sendId = inserted.id as string;
  }

  try {
    // ── c. Assemble content ────────────────────────────────────────────────
    const content = await assembleMorningBrief(targetDate);

    // ── d. Update send record with subject and article list ────────────────
    const { error: subjectUpdateError } = await supabase
      .from("newsletter_sends")
      .update({
        subject: content.subject,
        articles_included: content.articles.map((a) => a.url),
        status: "sending",
      })
      .eq("id", sendId);
    if (subjectUpdateError) console.error("[newsletter/send] Failed to persist subject/articles:", subjectUpdateError.message);

    // ── e. Send ────────────────────────────────────────────────────────────
    const { sentCount, failedCount, lastError } = await sendMorningBrief(content, sendId);

    // ── f. Mark complete ───────────────────────────────────────────────────
    // Distinguish every outcome that isn't a clean full success, so status
    // never says "sent" for a day that actually needs attention:
    //   - no_recipients: nobody matched (confirmed + daily) — could be a
    //     legitimate empty list, or an accidental audience-loss incident.
    //   - failed: every attempted recipient failed.
    //   - partial_failed: some succeeded, some didn't — still recoverable
    //     by re-running (retries skip already-succeeded recipients).
    //   - sent: full success.
    const completedAt = new Date();
    const noRecipients = sentCount === 0 && failedCount === 0;
    const allFailed = failedCount > 0 && sentCount === 0;
    const partialFailed = sentCount > 0 && failedCount > 0;
    const status = noRecipients ? "no_recipients" : allFailed ? "failed" : partialFailed ? "partial_failed" : "sent";
    const errorNote = noRecipients
      ? "No confirmed daily subscribers matched — verify this is expected before treating today as sent."
      : allFailed || partialFailed
        ? lastError ?? `${failedCount} of ${sentCount + failedCount} send(s) failed — see Resend/Sentry for cause.`
        : null;

    const { error: completeUpdateError } = await supabase
      .from("newsletter_sends")
      .update({
        status,
        subscriber_count: sentCount + failedCount,
        sent_count: sentCount,
        failed_count: failedCount,
        completed_at: completedAt.toISOString(),
        duration_ms: completedAt.getTime() - startedAt.getTime(),
        error: errorNote,
      })
      .eq("id", sendId);
    if (completeUpdateError) console.error("[newsletter/send] Failed to persist final send outcome:", completeUpdateError.message);

    // ── g. Response ────────────────────────────────────────────────────────
    return NextResponse.json({
      success: status === "sent",
      status,
      sendDate,
      subscriberCount: sentCount + failedCount,
      sentCount,
      failedCount,
      subject: content.subject,
      articlesIncluded: content.articles.map((a) => a.headline),
      ...(errorNote ? { error: errorNote } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { error: failureUpdateError } = await supabase
      .from("newsletter_sends")
      .update({ status: "failed", error: message })
      .eq("id", sendId);
    if (failureUpdateError) {
      console.error("[newsletter/send] Failed to persist failure status (this send's outcome is now unrecorded):", failureUpdateError.message);
    }

    console.error("[newsletter/send]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
