import { Resend } from "resend";
import * as Sentry from "@sentry/nextjs";
import { render } from "@react-email/components";
import { createAdminClient } from "@/app/lib/supabase-server";
import MorningBrief from "@/emails/morning-brief";
import type { MorningBriefContent } from "./content-assembler";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.thealignmenttimes.com";
const FROM_NAME  = process.env.FROM_NAME  ?? "The Alignment Times";
const FROM_EMAIL = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
const FROM = `${FROM_NAME} <${FROM_EMAIL}>`;
const BATCH_SIZE = 100;

// Placeholders replaced per-subscriber after a single template render
const UNSUB_PLACEHOLDER = "__UNSUB_URL__";
const PREFS_PLACEHOLDER = "__PREFS_URL__";

export interface SendResult {
  sentCount: number;
  failedCount: number;
  batchIds: string[];
  lastError?: string;
}

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  unsubscribe_token: string;
}

export async function sendMorningBrief(
  content: MorningBriefContent,
  sendId: string
): Promise<SendResult> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = createAdminClient();

  // ── a. Fetch confirmed daily subscribers ──────────────────────────────────
  const { data: rows, error: fetchError } = await supabase
    .from("subscribers")
    .select("id, email, first_name, unsubscribe_token")
    .eq("status", "confirmed")
    .eq("frequency", "daily");

  if (fetchError) throw new Error(`Subscriber fetch failed: ${fetchError.message}`);

  // Exclude subscribers already successfully delivered for this sendId, so a
  // forced/retried run after a partial failure doesn't re-send to people who
  // already got it.
  const { data: alreadySent, error: alreadySentError } = await supabase
    .from("newsletter_send_log")
    .select("subscriber_id")
    .eq("send_id", sendId)
    .eq("status", "sent");

  if (alreadySentError) {
    console.error("[newsletter/sender] Failed to load already-sent recipients — proceeding without dedup:", alreadySentError.message);
  }
  const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.subscriber_id as string));

  const subscribers = ((rows ?? []) as Subscriber[]).filter((s) => !alreadySentIds.has(s.id));

  // Render once with placeholder URLs — avoids N renders for large lists
  const baseHtml = await render(
    MorningBrief({
      date: content.date,
      marketSnapshot: content.marketSnapshot.length > 0 ? content.marketSnapshot : undefined,
      articles: content.articles.length > 0 ? content.articles : undefined,
      waterCoolerItem: content.waterCoolerItem ?? undefined,
      introText: content.introText,
      unsubscribeUrl: UNSUB_PLACEHOLDER,
      preferencesUrl: PREFS_PLACEHOLDER,
    })
  );

  let sentCount = 0;
  let failedCount = 0;
  const batchIds: string[] = [];
  let lastError: string | undefined;

  // ── b. Batches of 100 ────────────────────────────────────────────────────
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);

    const emails = batch.map((sub) => {
      const unsubUrl = `${SITE_URL}/api/newsletter/unsubscribe?token=${sub.unsubscribe_token}`;
      const prefsUrl = `${SITE_URL}/preferences?token=${sub.unsubscribe_token}`;
      return {
        from: FROM,
        to: sub.email,
        subject: content.subject,
        html: baseHtml
          .replaceAll(UNSUB_PLACEHOLDER, unsubUrl)
          .replaceAll(PREFS_PLACEHOLDER, prefsUrl),
        tags: [{ name: "send_id", value: sendId }],
      };
    });

    const { data: batchData, error: batchError } = await resend.batch.send(emails);
    const responses = batchData?.data ?? [];

    if (batchError || responses.length === 0) {
      failedCount += batch.length;
      lastError = batchError
        ? `${batchError.name ?? "ResendError"}: ${batchError.message ?? String(batchError)}`
        : "Resend batch returned empty responses";
      console.error(`[newsletter/sender] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, lastError);
      Sentry.captureException(batchError ?? new Error("Resend batch returned empty responses"), {
        tags: { service: "resend" },
        extra: { batchNumber: Math.floor(i / BATCH_SIZE) + 1, batchSize: batch.length, sendId },
      });
    } else {
      const logRows: {
        send_id: string;
        subscriber_id: string;
        email: string;
        resend_email_id: string;
        status: string;
      }[] = [];

      responses.forEach((resp, idx) => {
        const sub = batch[idx];
        if (resp?.id && sub) {
          sentCount++;
          batchIds.push(resp.id);
          logRows.push({
            send_id: sendId,
            subscriber_id: sub.id,
            email: sub.email,
            resend_email_id: resp.id,
            status: "sent",
          });
        } else {
          failedCount++;
        }
      });

      if (logRows.length > 0) {
        const { error: logError } = await supabase.from("newsletter_send_log").insert(logRows);
        if (logError) {
          console.error(`[newsletter/sender] Failed to persist send_log rows for batch ${Math.floor(i / BATCH_SIZE) + 1}:`, logError.message);
          Sentry.captureException(new Error(`newsletter_send_log insert failed: ${logError.message}`), {
            tags: { service: "supabase" },
            extra: { batchNumber: Math.floor(i / BATCH_SIZE) + 1, sendId },
          });
        }
      }
    }

    // 1 second between batches to respect Resend rate limits
    if (i + BATCH_SIZE < subscribers.length) {
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }

  // Recipients already delivered in an earlier attempt at this sendId (excluded
  // above) still count toward the cumulative total for the day.
  const cumulativeSentCount = alreadySentIds.size + sentCount;

  // ── c. Update newsletter_sends with final counts and batch IDs ────────────
  const { error: finalUpdateError } = await supabase
    .from("newsletter_sends")
    .update({
      sent_count: cumulativeSentCount,
      failed_count: failedCount,
      resend_batch_ids: batchIds,
    })
    .eq("id", sendId);

  if (finalUpdateError) {
    console.error("[newsletter/sender] Failed to persist final send counts:", finalUpdateError.message);
    Sentry.captureException(new Error(`newsletter_sends final update failed: ${finalUpdateError.message}`), {
      tags: { service: "supabase" },
      extra: { sendId, cumulativeSentCount, failedCount },
    });
  }

  return { sentCount: cumulativeSentCount, failedCount, batchIds, lastError };
}
