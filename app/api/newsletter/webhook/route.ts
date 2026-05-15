import { after } from "next/server";
import { Webhook } from "svix";
import { createAdminClient } from "@/app/lib/supabase-server";

// ── Resend event shape ────────────────────────────────────────────────────────

interface ResendEventData {
  email_id: string;
  from: string;
  to: string[];
  subject: string;
  tags?: { name: string; value: string }[];
  created_at: string;
}

interface ResendEvent {
  type: string;
  created_at: string;
  data: ResendEventData;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSendId(data: ResendEventData): string | null {
  return data.tags?.find((t) => t.name === "send_id")?.value ?? null;
}

function getEmail(data: ResendEventData): string | null {
  return data.to?.[0] ?? null;
}

// ── Event processor ───────────────────────────────────────────────────────────

async function processEvent(event: ResendEvent): Promise<void> {
  const supabase = createAdminClient();
  const { type, data } = event;
  const resendEmailId = data.email_id;
  const sendId = getSendId(data);
  const email = getEmail(data);
  const now = new Date().toISOString();

  switch (type) {
    case "email.sent": {
      if (!resendEmailId) break;
      await supabase
        .from("newsletter_send_log")
        .update({ status: "sent" })
        .eq("resend_email_id", resendEmailId);
      break;
    }

    case "email.delivered": {
      // Delivery confirmation — no schema column for this yet, log is sufficient
      break;
    }

    case "email.bounced": {
      if (!resendEmailId || !email) break;
      await Promise.all([
        supabase
          .from("newsletter_send_log")
          .update({ status: "bounced" })
          .eq("resend_email_id", resendEmailId),
        supabase
          .from("subscribers")
          .update({ status: "bounced" })
          .eq("email", email),
        sendId
          ? supabase.rpc("increment_send_count", {
              p_send_id: sendId,
              p_col: "bounce_count",
            })
          : null,
      ].filter(Boolean));
      break;
    }

    case "email.complained": {
      // Spam complaint — treat as hard unsubscribe, never email again
      if (!email) break;
      await supabase
        .from("subscribers")
        .update({ status: "complained", unsubscribed_at: now })
        .eq("email", email);
      break;
    }

    case "email.opened": {
      if (!resendEmailId || !email) break;

      // Only set opened_at the first time (if null)
      const { data: logRow } = await supabase
        .from("newsletter_send_log")
        .select("opened_at")
        .eq("resend_email_id", resendEmailId)
        .maybeSingle();

      await Promise.all([
        logRow && !logRow.opened_at
          ? supabase
              .from("newsletter_send_log")
              .update({ opened_at: now })
              .eq("resend_email_id", resendEmailId)
          : null,
        supabase.rpc("increment_subscriber_opens", { p_email: email, p_opened_at: now }),
        sendId
          ? supabase.rpc("increment_send_count", {
              p_send_id: sendId,
              p_col: "open_count",
            })
          : null,
      ].filter(Boolean));
      break;
    }

    case "email.clicked": {
      if (!resendEmailId || !email) break;

      const { data: logRow } = await supabase
        .from("newsletter_send_log")
        .select("first_click_at")
        .eq("resend_email_id", resendEmailId)
        .maybeSingle();

      await Promise.all([
        logRow && !logRow.first_click_at
          ? supabase
              .from("newsletter_send_log")
              .update({ first_click_at: now })
              .eq("resend_email_id", resendEmailId)
          : null,
        supabase.rpc("increment_subscriber_clicks", { p_email: email, p_clicked_at: now }),
        sendId
          ? supabase.rpc("increment_send_count", {
              p_send_id: sendId,
              p_col: "click_count",
            })
          : null,
      ].filter(Boolean));
      break;
    }

    default:
      // Unknown event type — ignore
      break;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const rawBody = await req.text();

  const svixHeaders = {
    "svix-id":        req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ResendEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(rawBody, svixHeaders) as ResendEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Return 200 immediately — process in background
  after(async () => {
    try {
      await processEvent(event);
    } catch (err) {
      console.error("[newsletter/webhook]", event.type, err);
    }
  });

  return new Response("OK", { status: 200 });
}
