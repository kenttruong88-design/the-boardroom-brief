import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { assembleMorningBrief } from "@/app/lib/newsletter/content-assembler";
import MorningBrief from "@/emails/morning-brief";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_TEST_ROUTES) {
    return NextResponse.json({ error: "Test routes are disabled in production" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email") ?? process.env.EDITOR_EMAIL;

  if (!email) {
    return NextResponse.json(
      { error: "Provide ?email= or set EDITOR_EMAIL env var" },
      { status: 400 }
    );
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const content = await assembleMorningBrief(new Date());

  const unsubscribeUrl = `${SITE_URL}/api/newsletter/unsubscribe?token=test_preview`;
  const preferencesUrl = `${SITE_URL}/preferences?token=test_preview`;

  const html = await render(
    MorningBrief({
      date: content.date,
      marketSnapshot: content.marketSnapshot.length > 0 ? content.marketSnapshot : undefined,
      articles: content.articles.length > 0 ? content.articles : undefined,
      waterCoolerItem: content.waterCoolerItem ?? undefined,
      introText: content.introText,
      unsubscribeUrl,
      preferencesUrl,
    })
  );

  const resend = new Resend(resendKey);
  const { data, error } = await resend.emails.send({
    from: `${process.env.FROM_NAME ?? "The Alignment Times"} <${process.env.FROM_EMAIL ?? "onboarding@resend.dev"}>`,
    to: [email],
    subject: `[TEST] ${content.subject}`,
    html,
    tags: [{ name: "type", value: "test" }],
  });

  if (error || !data?.id) {
    return NextResponse.json({ error: error?.message ?? "Send failed" }, { status: 500 });
  }

  return NextResponse.json({
    subject: content.subject,
    introText: content.introText,
    articleCount: content.articles.length,
    marketSnapshotCount: content.marketSnapshot.length,
    hasWaterCooler: content.waterCoolerItem !== null,
    emailSentTo: email,
    resendEmailId: data.id,
    previewUrl: `https://resend.com/emails/${data.id}`,
  });
}
