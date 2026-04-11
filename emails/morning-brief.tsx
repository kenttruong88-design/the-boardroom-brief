import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

export interface MarketItem {
  symbol: string;
  name: string;
  price: string;
  changePct: string;
  up: boolean;
}

export interface ArticleItem {
  title: string;
  satiricalHeadline: string;
  excerpt: string;
  pillar: string;
  slug: string;
  pillarSlug: string;
}

export interface MorningBriefProps {
  date?: string;
  markets?: MarketItem[];
  leadArticle?: ArticleItem;
  articles?: ArticleItem[];
  waterCooler?: string;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  siteUrl?: string;
}

const defaultMarkets: MarketItem[] = [
  { symbol: "S&P 500", name: "S&P 500",  price: "5,218",  changePct: "+0.87%", up: true  },
  { symbol: "DAX",     name: "DAX",      price: "18,492", changePct: "+0.31%", up: true  },
  { symbol: "FTSE",    name: "FTSE 100", price: "8,112",  changePct: "-0.14%", up: false },
  { symbol: "Nikkei",  name: "Nikkei",   price: "39,872", changePct: "+1.22%", up: true  },
  { symbol: "Gold",    name: "Gold",     price: "$2,318", changePct: "+0.54%", up: true  },
  { symbol: "BTC",     name: "Bitcoin",  price: "$68,420",changePct: "+1.85%", up: true  },
];

const defaultLead: ArticleItem = {
  title: "Fed Holds Rates, Signals Caution, Refuses to Commit to Anything Specific",
  satiricalHeadline: "Central bank opts for maximum optionality, minimum clarity.",
  excerpt: "The Federal Reserve held interest rates steady at its latest meeting, citing a complex macroeconomic environment that defies simple characterisation. Officials described the path forward as 'data dependent', which is central bank speak for 'we have no idea either'.",
  pillar: "Markets Floor",
  pillarSlug: "markets-floor",
  slug: "fed-holds-rates-signals-caution-2026",
};

const defaultArticles: ArticleItem[] = [
  {
    title: "NVIDIA's Enterprise AI Push Signals Spending Surge",
    satiricalHeadline: "Everyone is buying GPUs. Nobody knows exactly why.",
    excerpt: "Enterprise AI adoption accelerates as NVIDIA reports record data centre revenue.",
    pillar: "Markets Floor",
    pillarSlug: "markets-floor",
    slug: "nvidia-enterprise-ai-spending-surge",
  },
  {
    title: "China's Q1 GDP Rebound Surprises Analysts",
    satiricalHeadline: "Economists were wrong again. They are handling it with dignity.",
    excerpt: "China's economy expanded faster than forecast in the first quarter.",
    pillar: "Macro Mondays",
    pillarSlug: "macro-mondays",
    slug: "china-gdp-q1-2026-rebound",
  },
  {
    title: "Remote Work Policy Wars: The Sequel",
    satiricalHeadline: "Return-to-office mandates return. Employees' enthusiasm does not.",
    excerpt: "Major corporations are doubling down on office attendance requirements.",
    pillar: "C-Suite Circus",
    pillarSlug: "c-suite-circus",
    slug: "return-to-office-mandate-wave-2026",
  },
];

const NAVY  = "#0f1923";
const CREAM = "#f5f0e8";
const RED   = "#c8391a";
const GOLD  = "#b8960c";
const MUTED = "#666666";
const BORDER = "#ddd8ce";

export default function MorningBrief({
  date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
  markets = defaultMarkets,
  leadArticle = defaultLead,
  articles = defaultArticles,
  waterCooler = "Today's corporate wisdom: if a meeting could have been an email, the email could probably have been nothing.",
  unsubscribeUrl = "https://thealignmenttimes.com/unsubscribe",
  preferencesUrl = "https://thealignmenttimes.com/preferences",
  siteUrl = "https://thealignmenttimes.com",
}: MorningBriefProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Markets opened. Coffee optional. Your briefing is ready.</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: CREAM }}>

          {/* Top bar */}
          <Section style={{ backgroundColor: NAVY, padding: "0" }}>
            <Row>
              <Column style={{ padding: "12px 24px" }}>
                <Text style={{ color: GOLD, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", margin: 0 }}>
                  Executive Intelligence
                </Text>
              </Column>
              <Column style={{ padding: "12px 24px", textAlign: "right" }}>
                <Text style={{ color: "rgba(245,240,232,0.45)", fontSize: "10px", fontFamily: "Arial, sans-serif", margin: 0 }}>
                  {date}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Masthead */}
          <Section style={{ backgroundColor: NAVY, padding: "24px 24px 28px", borderBottom: `3px solid ${RED}` }}>
            <Heading style={{ color: CREAM, fontSize: "32px", fontFamily: "Georgia, serif", margin: "0 0 6px", fontWeight: "700", letterSpacing: "-0.5px" }}>
              The Alignment Times
            </Heading>
            <Text style={{ color: "rgba(245,240,232,0.55)", fontSize: "13px", fontFamily: "Arial, sans-serif", margin: 0 }}>
              Good morning. Markets opened. Coffee optional.
            </Text>
          </Section>

          {/* Market snapshot */}
          <Section style={{ padding: "20px 24px", backgroundColor: "#f0ebe0", borderBottom: `1px solid ${BORDER}` }}>
            <Text style={{ color: NAVY, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 12px" }}>
              Market Snapshot
            </Text>
            <Row>
              {markets.slice(0, 3).map((m) => (
                <Column key={m.symbol} style={{ width: "33%", textAlign: "center", padding: "8px 4px", borderRight: `1px solid ${BORDER}` }}>
                  <Text style={{ color: MUTED, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 2px" }}>{m.symbol}</Text>
                  <Text style={{ color: NAVY, fontSize: "14px", fontFamily: "'Courier New', monospace", fontWeight: "700", margin: "0 0 2px" }}>{m.price}</Text>
                  <Text style={{ color: m.up ? "#16a34a" : "#dc2626", fontSize: "11px", fontFamily: "'Courier New', monospace", margin: 0 }}>{m.changePct}</Text>
                </Column>
              ))}
            </Row>
            <Row style={{ marginTop: "4px" }}>
              {markets.slice(3, 6).map((m) => (
                <Column key={m.symbol} style={{ width: "33%", textAlign: "center", padding: "8px 4px", borderRight: `1px solid ${BORDER}` }}>
                  <Text style={{ color: MUTED, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 2px" }}>{m.symbol}</Text>
                  <Text style={{ color: NAVY, fontSize: "14px", fontFamily: "'Courier New', monospace", fontWeight: "700", margin: "0 0 2px" }}>{m.price}</Text>
                  <Text style={{ color: m.up ? "#16a34a" : "#dc2626", fontSize: "11px", fontFamily: "'Courier New', monospace", margin: 0 }}>{m.changePct}</Text>
                </Column>
              ))}
            </Row>
          </Section>

          {/* Lead story */}
          <Section style={{ padding: "28px 24px", borderBottom: `1px solid ${BORDER}` }}>
            <Text style={{ color: RED, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 12px" }}>
              Lead Story
            </Text>
            <Heading as="h2" style={{ color: NAVY, fontSize: "24px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.25", margin: "0 0 8px" }}>
              {leadArticle.title}
            </Heading>
            <Text style={{ color: RED, fontSize: "14px", fontFamily: "Georgia, serif", fontStyle: "italic", margin: "0 0 14px" }}>
              {leadArticle.satiricalHeadline}
            </Text>
            <Hr style={{ borderColor: BORDER, margin: "0 0 14px" }} />
            <Text style={{ color: "#333", fontSize: "15px", fontFamily: "Georgia, serif", lineHeight: "1.65", margin: "0 0 20px" }}>
              {leadArticle.excerpt}
            </Text>
            <Button
              href={`${siteUrl}/${leadArticle.pillarSlug}/${leadArticle.slug}`}
              style={{ backgroundColor: RED, color: "#fff", fontFamily: "Arial, sans-serif", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", padding: "10px 20px", borderRadius: "2px", textDecoration: "none", display: "inline-block" }}
            >
              Read in full →
            </Button>
          </Section>

          {/* 3 article cards */}
          <Section style={{ padding: "24px 24px 8px", borderBottom: `1px solid ${BORDER}` }}>
            <Text style={{ color: NAVY, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 16px" }}>
              Also in today's brief
            </Text>
            {articles.slice(0, 3).map((a, i) => (
              <Row key={a.slug} style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: i < 2 ? `1px solid ${BORDER}` : "none" }}>
                <Column style={{ width: "8px", paddingRight: "12px" }}>
                  <Text style={{ color: RED, fontSize: "18px", fontFamily: "Georgia, serif", fontWeight: "700", margin: 0 }}>{i + 2}</Text>
                </Column>
                <Column>
                  <Text style={{ color: MUTED, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "1.5px", textTransform: "uppercase", margin: "0 0 4px" }}>
                    {a.pillar}
                  </Text>
                  <Link href={`${siteUrl}/${a.pillarSlug}/${a.slug}`} style={{ textDecoration: "none" }}>
                    <Text style={{ color: NAVY, fontSize: "15px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.3", margin: "0 0 4px" }}>
                      {a.title}
                    </Text>
                  </Link>
                  <Text style={{ color: RED, fontSize: "12px", fontFamily: "Georgia, serif", fontStyle: "italic", margin: 0 }}>
                    {a.satiricalHeadline}
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>

          {/* Water Cooler */}
          <Section style={{ padding: "20px 24px", backgroundColor: NAVY, borderBottom: `3px solid ${RED}` }}>
            <Text style={{ color: GOLD, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 8px" }}>
              Water Cooler
            </Text>
            <Text style={{ color: CREAM, fontSize: "14px", fontFamily: "Georgia, serif", fontStyle: "italic", lineHeight: "1.6", margin: 0 }}>
              "{waterCooler}"
            </Text>
          </Section>

          {/* Footer */}
          <Section style={{ padding: "20px 24px", backgroundColor: "#e8e2d8" }}>
            <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: "0 0 8px" }}>
              <Link href={preferencesUrl} style={{ color: MUTED, textDecoration: "underline" }}>Manage preferences</Link>
              {"  ·  "}
              <Link href={unsubscribeUrl} style={{ color: MUTED, textDecoration: "underline" }}>Unsubscribe</Link>
              {"  ·  "}
              <Link href={siteUrl} style={{ color: MUTED, textDecoration: "underline" }}>Visit site</Link>
            </Text>
            <Text style={{ color: "#aaa", fontSize: "10px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: 0 }}>
              © {new Date().getFullYear()} The Alignment Times. Real markets. Real news. Questionable corporate poetry.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
