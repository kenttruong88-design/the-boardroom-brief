import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { createAdminClient } from "@/app/lib/supabase";
import Welcome from "@/emails/welcome";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/subscribe?error=missing_token`);
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("subscribers")
    .update({ confirmed: true, confirmation_token: null })
    .eq("confirmation_token", token)
    .select("email")
    .single();

  if (error || !data) {
    return NextResponse.redirect(`${siteUrl}/subscribe?error=invalid_token`);
  }

  // Send welcome email
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const html = await render(Welcome({
        preferencesUrl: `${siteUrl}/welcome`,
        siteUrl,
      }));
      await resend.emails.send({
        from: "The Alignment Times <brief@thealignmenttimes.com>",
        to: data.email,
        subject: "Welcome to The Alignment Times",
        html,
      });
    } catch { /* welcome email failure shouldn't block redirect */ }
  }

  return NextResponse.redirect(`${siteUrl}/welcome?email=${encodeURIComponent(data.email)}`);
}
