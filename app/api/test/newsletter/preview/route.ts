import { assembleMorningBrief } from "@/app/lib/newsletter/content-assembler";
import MorningBrief from "@/emails/morning-brief";
import { render } from "@react-email/components";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function GET() {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_TEST_ROUTES) {
    return new Response(JSON.stringify({ error: "Test routes are disabled in production" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const content = await assembleMorningBrief(new Date());

  const html = await render(
    MorningBrief({
      date: content.date,
      marketSnapshot: content.marketSnapshot.length > 0 ? content.marketSnapshot : undefined,
      articles: content.articles.length > 0 ? content.articles : undefined,
      waterCoolerItem: content.waterCoolerItem ?? undefined,
      introText: content.introText,
      unsubscribeUrl: `${SITE_URL}/api/newsletter/unsubscribe?token=preview`,
      preferencesUrl: `${SITE_URL}/preferences?token=preview`,
    })
  );

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
