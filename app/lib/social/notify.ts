import { Resend } from "resend";

// Email alerts for the social pipeline (failures, daily summary), sent through Resend
// to the editor address. Never throws: a missing key or a send error must not break a cron.

const FROM = "The Alignment Times <hello@alignmenttimes.com>";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendSocialEmail(subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.EDITOR_EMAIL ?? process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  if (!key || !to) {
    console.warn("[social/notify] RESEND_API_KEY or EDITOR_EMAIL not set — email not sent:", subject);
    return false;
  }
  try {
    const { error } = await new Resend(key).emails.send({ from: FROM, to, subject, html });
    if (error) { console.warn("[social/notify] send failed:", error.message); return false; }
    return true;
  } catch (err) {
    console.warn("[social/notify] send threw:", err instanceof Error ? err.message : String(err));
    return false;
  }
}
