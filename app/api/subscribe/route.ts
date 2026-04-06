import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { render } from "@react-email/components";
import Confirmation from "@/emails/confirmation";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, segments, source } = body as {
      email?: string;
      segments?: string[];
      source?: string;
    };

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Check if already subscribed
    const { data: existing } = await supabase
      .from("subscribers")
      .select("id, confirmed")
      .eq("email", email)
      .single();

    if (existing?.confirmed) {
      return NextResponse.json({ message: "already_subscribed" });
    }

    const token = randomBytes(32).toString("hex");

    if (existing) {
      // Re-send confirmation
      await supabase
        .from("subscribers")
        .update({ confirmation_token: token, segments: segments ?? [] })
        .eq("email", email);
    } else {
      await supabase.from("subscribers").insert({
        email,
        confirmed: false,
        confirmation_token: token,
        plan: "free",
        segments: segments ?? [],
        source: source ?? "website",
      });
    }

    // Send confirmation email via Resend + React Email template
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://theboardroombrief.com";
      const confirmUrl = `${siteUrl}/api/confirm?token=${token}`;
      const resend = new Resend(resendKey);
      const html = await render(Confirmation({ confirmUrl, email }));
      await resend.emails.send({
        from: "The Boardroom Brief <brief@theboardroombrief.com>",
        to: [email],
        subject: "Confirm your subscription — The Boardroom Brief",
        html,
      });
    }

    return NextResponse.json({ message: "confirmation_sent" });
  } catch (err) {
    console.error("[subscribe]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
