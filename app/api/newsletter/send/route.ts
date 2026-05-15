import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { assembleMorningBrief } from "@/app/lib/newsletter/content-assembler";
import { sendMorningBrief } from "@/app/lib/newsletter/sender";

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
  return runSend(req);
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
    await supabase
      .from("newsletter_sends")
      .update({ status: "pending", error: null, started_at: startedAt.toISOString() })
      .eq("id", sendId);
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
    await supabase
      .from("newsletter_sends")
      .update({
        subject: content.subject,
        articles_included: content.articles.map((a) => a.url),
        status: "sending",
      })
      .eq("id", sendId);

    // ── e. Send ────────────────────────────────────────────────────────────
    const { sentCount, failedCount } = await sendMorningBrief(content, sendId);

    // ── f. Mark complete ───────────────────────────────────────────────────
    const completedAt = new Date();
    await supabase
      .from("newsletter_sends")
      .update({
        status: "sent",
        subscriber_count: sentCount + failedCount,
        sent_count: sentCount,
        failed_count: failedCount,
        completed_at: completedAt.toISOString(),
        duration_ms: completedAt.getTime() - startedAt.getTime(),
      })
      .eq("id", sendId);

    // ── g. Response ────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      sendDate,
      subscriberCount: sentCount + failedCount,
      sentCount,
      failedCount,
      subject: content.subject,
      articlesIncluded: content.articles.map((a) => a.headline),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("newsletter_sends")
      .update({ status: "failed", error: message })
      .eq("id", sendId);

    console.error("[newsletter/send]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
