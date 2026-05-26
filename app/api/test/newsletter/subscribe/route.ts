import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { render } from "@react-email/components";
import NewsletterConfirmation from "@/emails/newsletter-confirmation";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_TEST_ROUTES) {
    return NextResponse.json({ error: "Test routes are disabled in production" }, { status: 403 });
  }

  try {
    const body = await req.json() as { email?: string; firstName?: string };
    const { email, firstName } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const token = randomBytes(32).toString("hex");
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from("subscribers")
      .select("id, status")
      .eq("email", email)
      .single();

    if (existing) {
      await supabase
        .from("subscribers")
        .update({
          confirmation_token: token,
          confirmation_sent_at: now,
          status: "pending",
          first_name: firstName ?? null,
        })
        .eq("email", email);
    } else {
      await supabase.from("subscribers").insert({
        email,
        first_name: firstName ?? null,
        status: "pending",
        confirmation_token: token,
        confirmation_sent_at: now,
        segments: ["all"],
        source: "test",
      });
    }

    const { data: subscriber } = await supabase
      .from("subscribers")
      .select("id")
      .eq("email", email)
      .single();

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const confirmUrl = `${siteUrl}/api/confirm?token=${token}`;

    let emailSent = false;
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const html = await render(
          NewsletterConfirmation({
            firstName,
            confirmUrl,
            previewText: "One click to confirm — then the Morning Brief begins.",
          })
        );
        await resend.emails.send({
          from: `${process.env.FROM_NAME ?? "The Alignment Times"} <${process.env.FROM_EMAIL ?? "onboarding@resend.dev"}>`,
          to: [email],
          subject: "Confirm your Alignment Times subscription",
          html,
        });
        emailSent = true;
      } catch {
        emailSent = false;
      }
    }

    return NextResponse.json({
      subscriberId: subscriber?.id ?? null,
      confirmationToken: token,
      confirmUrl,
      emailSent,
    });
  } catch (err) {
    console.error("[test/newsletter/subscribe]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
