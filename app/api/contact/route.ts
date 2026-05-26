import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { Resend } from "resend";
import { adminClient } from "@/app/lib/supabase/admin";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ok(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function hashIp(ip: string): string {
  return createHash("sha256")
    .update(ip + (process.env.IP_HASH_SALT ?? "tbb-contact"))
    .digest("hex")
    .slice(0, 16);
}

// ─── POST /api/contact ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body");
  }

  if (!body || typeof body !== "object") return err("Invalid request body");

  const { name, email, subject, message, website } = body as {
    name?: unknown;
    email?: unknown;
    subject?: unknown;
    message?: unknown;
    website?: unknown;
  };

  // ── a. Honeypot — silently accept bot submissions ──────────────────────────
  if (typeof website === "string" && website.trim().length > 0) {
    return ok({ success: true });
  }

  // ── b. Validate required fields ────────────────────────────────────────────
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return err("Please enter your name");
  }
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return err("Please enter a valid email address");
  }
  if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
    return err("Please select a subject");
  }
  if (!message || typeof message !== "string" || message.trim().length < 20) {
    return err("Message must be at least 20 characters");
  }

  const safeName    = name.trim().slice(0, 200);
  const safeEmail   = email.trim().toLowerCase().slice(0, 254);
  const safeSubject = subject.trim().slice(0, 100);
  const safeMessage = message.trim().slice(0, 5000);

  // ── c. Rate limit: max 3 submissions per IP per hour ──────────────────────
  const rawIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const ipHash = hashIp(rawIp);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count } = await adminClient
    .from("contact_submissions")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= 3) {
    return err(
      "Too many messages from this IP address. Please wait an hour and try again.",
      429
    );
  }

  // ── d. Store in contact_submissions ───────────────────────────────────────
  const { error: insertError } = await adminClient
    .from("contact_submissions")
    .insert({
      name:     safeName,
      email:    safeEmail,
      subject:  safeSubject,
      message:  safeMessage,
      ip_hash:  ipHash,
    });

  if (insertError) {
    console.error("[contact] insert error:", insertError);
    return err("Could not save your message. Please try again.", 500);
  }

  // ── e & f. Send emails via Resend ─────────────────────────────────────────
  if (!process.env.RESEND_API_KEY) {
    console.log("[contact] RESEND_API_KEY not set — skipping emails");
    return ok({ success: true });
  }

  const resend = getResend();
  const editorEmail =
    process.env.EDITOR_EMAIL ??
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ??
    "hello@alignmenttimes.com";

  const fromAddress = "The Alignment Times <hello@alignmenttimes.com>";
  const timestamp = new Date().toLocaleString("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  });

  await Promise.allSettled([
    // Notification to editor
    resend.emails.send({
      from: fromAddress,
      to: editorEmail,
      subject: `[Contact] ${safeSubject} from ${safeName}`,
      html: `
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <p><strong>Message:</strong></p>
        <blockquote style="border-left:3px solid #c8391a;padding-left:12px;margin:8px 0;">
          ${safeMessage.replace(/\n/g, "<br>")}
        </blockquote>
        <p style="color:#7a7a7a;font-size:13px;">Sent at ${timestamp} UTC</p>
      `.trim(),
    }),

    // Auto-reply to sender
    resend.emails.send({
      from: fromAddress,
      to: safeEmail,
      subject: "We received your message — The Alignment Times",
      html: `
        <p>Hi ${safeName},</p>
        <p>
          Thanks for getting in touch. We received your message about
          &ldquo;${safeSubject}&rdquo; and will respond within 2 business days.
        </p>
        <p>
          If your enquiry is urgent, you can also reach us directly at
          ${editorEmail}.
        </p>
        <p style="color:#7a7a7a;font-size:13px;">
          &mdash; The Alignment Times
        </p>
      `.trim(),
    }),
  ]);

  return ok({ success: true });
}
