import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { createAdminClient } from "@/app/lib/supabase-server";
import NewsletterWelcome from "@/emails/newsletter-welcome";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://theboardroombrief.com";

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/subscribe?error=missing_token`);
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("subscribers")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmation_token: null,
    })
    .eq("confirmation_token", token)
    .eq("status", "pending")
    .select("email, first_name")
    .single();

  if (error || !data) {
    return NextResponse.redirect(`${siteUrl}/subscribe?error=invalid_token`);
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const html = await render(
        NewsletterWelcome({
          firstName: data.first_name ?? undefined,
          preferencesUrl: `${siteUrl}/preferences`,
          sampleArticle: {
            headline: "Fed Holds Rates, Signals Caution, Refuses to Commit to Anything Specific",
            satiricalHeadline: "Central bank opts for maximum optionality, minimum clarity.",
            url: `${siteUrl}/markets-floor/fed-holds-rates`,
          },
        })
      );
      await resend.emails.send({
        from: "The Boardroom Brief <brief@theboardroombrief.com>",
        to: data.email,
        subject: "Welcome to The Boardroom Brief",
        html,
      });
    } catch { /* welcome email failure shouldn't block redirect */ }
  }

  return NextResponse.redirect(
    `${siteUrl}/welcome?subscribed=true&email=${encodeURIComponent(data.email)}`
  );
}
