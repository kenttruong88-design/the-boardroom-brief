import { Resend } from "resend";
import { render } from "@react-email/components";
import { createAdminClient } from "@/app/lib/supabase-server";
import DailyDigestEmail from "@/emails/daily-digest";
import type { ArticleDraft, EditorReview, DailyDigest } from "./types";

// ── compileDailyDigest ────────────────────────────────────────────────────────

export function compileDailyDigest(
  allDrafts: Array<{ draft: ArticleDraft; review: EditorReview }>
): DailyDigest {
  const date = new Date().toISOString().split("T")[0];
  const passed = allDrafts.filter((a) => a.review.passed);
  const rejected = allDrafts.filter((a) => !a.review.passed);

  return {
    date,
    totalArticles: allDrafts.length,
    passedArticles: passed.length,
    rejectedArticles: rejected.length,
    articles: allDrafts,
  };
}

// ── persistDigest ─────────────────────────────────────────────────────────────

export async function persistDigest(digest: DailyDigest): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("daily_digest")
    .upsert(
      {
        date: digest.date,
        digest_json: digest,
        articles_approved: 0,
        articles_rejected: 0,
      },
      { onConflict: "date" }
    );
}

// ── sendDailyDigestEmail ──────────────────────────────────────────────────────

export async function sendDailyDigestEmail(digest: DailyDigest): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const editorEmail = process.env.EDITOR_EMAIL;

  if (!resendKey || !editorEmail) {
    console.warn("[digest] RESEND_API_KEY or EDITOR_EMAIL not set — skipping email");
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealignmenttimes.com";
  const html = await render(DailyDigestEmail({ digest, siteUrl }));
  const subject = `Boardroom Brief — ${digest.passedArticles} article${digest.passedArticles !== 1 ? "s" : ""} ready for review — ${digest.date}`;

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from: "The Alignment Times Editorial <editorial@thealignmenttimes.com>",
    to: [editorEmail],
    subject,
    html,
  });

  if (error) {
    throw new Error(`[digest] Resend error: ${error.message}`);
  }

  // Mark email sent in Supabase
  const supabase = createAdminClient();
  await supabase
    .from("daily_digest")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("date", digest.date);
}
