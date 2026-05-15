import { render } from "@react-email/components";
import NewsletterConfirmation from "@/emails/newsletter-confirmation";
import NewsletterWelcome from "@/emails/newsletter-welcome";
import NewsletterUnsubscribe from "@/emails/newsletter-unsubscribe";
import MorningBrief from "@/emails/morning-brief";
import type { MarketSnapshotItem, NewsletterArticle } from "@/emails/morning-brief";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const MOCK_ARTICLES: NewsletterArticle[] = [
  {
    headline: "Fed Holds Rates, Signals Caution, Refuses to Commit to Anything Specific",
    satiricalHeadline: "Central bank opts for maximum optionality, minimum clarity.",
    excerpt: "The Federal Reserve held its benchmark rate steady for the third consecutive meeting, citing persistent uncertainty in the inflation outlook and labour market conditions that remain, in the Fed's words, 'solid but not spectacular.'",
    url: `${SITE_URL}/markets-floor/fed-holds-rates`,
    pillar: "Markets Floor",
    pillarColor: "#1e40af",
    author: "Sarah Chen",
  },
  {
    headline: "Tech Giants Report Earnings, Investors Celebrate, Analysts Hedge",
    satiricalHeadline: "Beats expectations, guidance vague, conference call peppered with 'execution discipline'.",
    excerpt: "A strong earnings season for mega-cap technology continues as the sector reports above-consensus results for the fourth quarter, though forward guidance remains deliberately opaque.",
    url: `${SITE_URL}/markets-floor/tech-earnings`,
    pillar: "Markets Floor",
    pillarColor: "#1e40af",
    author: "James Park",
  },
  {
    headline: "European Banks Navigate Regulatory Headwinds Ahead of Stress Tests",
    satiricalHeadline: "The ECB wants receipts. Management teams want extensions.",
    excerpt: "European lenders are bracing for the latest round of regulatory stress tests as the ECB tightens its supervisory grip on capital adequacy frameworks.",
    url: `${SITE_URL}/macro-mondays/european-banks`,
    pillar: "Macro Mondays",
    pillarColor: "#7c3aed",
    author: "Elena Rossi",
  },
  {
    headline: "CEO of Major Retailer Steps Down After 'Strategic Realignment'",
    satiricalHeadline: "Translation: Q3 was bad, Q4 looks worse, the board has opinions.",
    excerpt: "The chief executive of one of the world's largest retailers has announced their departure following a strategic review that concluded the company needs 'new leadership energy for the next chapter.'",
    url: `${SITE_URL}/c-suite-circus/ceo-departure`,
    pillar: "C-Suite Circus",
    pillarColor: "#0f766e",
    author: "Marcus Webb",
  },
];

const MOCK_WATER_COOLER: NewsletterArticle = {
  headline: "Intern Sends Accidental Reply-All; Company Culture Seminar Scheduled",
  satiricalHeadline: "Organisational learning opportunity surfaces via email mishap.",
  excerpt: "An end-of-day email intended for one person somehow reached 4,200 employees and the CEO's PA, prompting an immediate 'communication hygiene' workshop for Q2.",
  url: `${SITE_URL}/water-cooler/reply-all`,
  pillar: "Water Cooler",
  pillarColor: "#b8960c",
};

const MOCK_MARKET_SNAPSHOT: MarketSnapshotItem[] = [
  { symbol: "S&P 500", name: "SPDR S&P 500 ETF", price: "5,204.34", changePct: "+0.42%", direction: "up" },
  { symbol: "DAX",     name: "DAX Index",         price: "17,892.10", changePct: "-0.18%", direction: "down" },
  { symbol: "FTSE 100", name: "iShares Core FTSE 100", price: "7,683.12", changePct: "+0.07%", direction: "up" },
  { symbol: "Nikkei",  name: "iShares MSCI Japan", price: "39,140.22", changePct: "+1.12%", direction: "up" },
  { symbol: "Hang Seng", name: "iShares China Large-Cap", price: "16,512.90", changePct: "-0.53%", direction: "down" },
  { symbol: "Bovespa", name: "iShares MSCI Brazil", price: "127,340.00", changePct: "+0.29%", direction: "up" },
];

type TemplateName = "confirmation" | "welcome" | "morning-brief" | "unsubscribe";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_TEST_ROUTES) {
    return new Response(JSON.stringify({ error: "Test routes are disabled in production" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const template = (searchParams.get("template") ?? "morning-brief") as TemplateName;

  let html: string;

  switch (template) {
    case "confirmation":
      html = await render(
        NewsletterConfirmation({
          firstName: "Alex",
          confirmUrl: `${SITE_URL}/api/confirm?token=mock_token_preview_abc123`,
          previewText: "One click to confirm — then the Morning Brief begins.",
        })
      );
      break;

    case "welcome":
      html = await render(
        NewsletterWelcome({
          firstName: "Alex",
          preferencesUrl: `${SITE_URL}/preferences?token=mock_token_preview`,
          sampleArticle: {
            headline: MOCK_ARTICLES[0].headline,
            satiricalHeadline: MOCK_ARTICLES[0].satiricalHeadline,
            url: MOCK_ARTICLES[0].url,
          },
        })
      );
      break;

    case "unsubscribe":
      html = await render(
        NewsletterUnsubscribe({
          firstName: "Alex",
          resubscribeUrl: `${SITE_URL}/subscribe`,
          feedbackUrl: `${SITE_URL}/unsubscribed`,
          siteUrl: SITE_URL,
        })
      );
      break;

    case "morning-brief":
    default:
      html = await render(
        MorningBrief({
          date: new Date().toLocaleDateString("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          }),
          firstName: "Alex",
          marketSnapshot: MOCK_MARKET_SNAPSHOT,
          articles: MOCK_ARTICLES,
          waterCoolerItem: MOCK_WATER_COOLER,
          introText: "Markets opened with a cautious tone as traders weigh Fed commentary against resilient jobs data. The gap between what central banks say and what markets believe has rarely been this wide.",
          unsubscribeUrl: `${SITE_URL}/api/newsletter/unsubscribe?token=preview`,
          preferencesUrl: `${SITE_URL}/preferences?token=preview`,
        })
      );
      break;
  }

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
