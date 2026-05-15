import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { render } from "@react-email/components";
import NewsletterConfirmation from "@/emails/newsletter-confirmation";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, firstName, segments, source, sourceArticleSlug } = body as {
      email?: string;
      firstName?: string;
      segments?: string[];
      source?: string;
      sourceArticleSlug?: string;
    };

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("subscribers")
      .select("id, status")
      .eq("email", email)
      .single();

    if (existing?.status === "confirmed") {
      return NextResponse.json({ message: "already_subscribed" });
    }

    const token = randomBytes(32).toString("hex");
    const now = new Date().toISOString();

    if (existing) {
      await supabase
        .from("subscribers")
        .update({
          confirmation_token: token,
          confirmation_sent_at: now,
          segments: segments ?? existing,
          status: "pending",
        })
        .eq("email", email);
    } else {
      await supabase.from("subscribers").insert({
        email,
        first_name: firstName ?? null,
        status: "pending",
        confirmation_token: token,
        confirmation_sent_at: now,
        segments: segments ?? ["{all}"],
        source: source ?? "website",
        source_article_slug: sourceArticleSlug ?? null,
      });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://theboardroombrief.com";
      const confirmUrl = `${siteUrl}/api/confirm?token=${token}`;
      const resend = new Resend(resendKey);
      const html = await render(
        NewsletterConfirmation({
          firstName,
          confirmUrl,
          previewText: "One click to confirm — then the Morning Brief begins.",
        })
      );
      await resend.emails.send({
        from: `${process.env.FROM_NAME ?? "The Boardroom Brief"} <${process.env.FROM_EMAIL ?? "onboarding@resend.dev"}>`,
        to: [email],
        subject: "Confirm your Boardroom Brief subscription",
        html,
      });
    }

    return NextResponse.json({ message: "confirmation_sent" });
  } catch (err) {
    console.error("[subscribe]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
