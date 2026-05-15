import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

export interface MarketSnapshotItem {
  symbol: string;
  name: string;
  price: string;
  changePct: string;
  direction: "up" | "down" | "flat";
}

export interface NewsletterArticle {
  headline: string;
  satiricalHeadline: string;
  excerpt: string;
  url: string;
  pillar: string;
  pillarColor: string;
  imageUrl?: string;
  author?: string;
}

export interface SponsorBlock {
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  logoUrl?: string;
}

interface Props {
  date?: string;
  firstName?: string;
  marketSnapshot?: MarketSnapshotItem[];
  articles?: NewsletterArticle[];
  waterCoolerItem?: NewsletterArticle;
  introText?: string;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  sponsorContent?: SponsorBlock;
}

const NAVY   = "#0f1923";
const CREAM  = "#f5f0e8";
const RED    = "#c8391a";
const GOLD   = "#b8960c";
const MUTED  = "#666666";
const BORDER = "#ddd8ce";
const GREEN  = "#16a34a";
const DKRED  = "#dc2626";

const DEFAULT_MARKETS: MarketSnapshotItem[] = [
  { symbol: "S&P 500", name: "S&P 500",  price: "5,218",   changePct: "+0.87%", direction: "up"   },
  { symbol: "DAX",     name: "DAX",      price: "18,492",  changePct: "+0.31%", direction: "up"   },
  { symbol: "FTSE",    name: "FTSE 100", price: "8,112",   changePct: "-0.14%", direction: "down" },
  { symbol: "Nikkei",  name: "Nikkei",   price: "39,872",  changePct: "+1.22%", direction: "up"   },
  { symbol: "Gold",    name: "Gold",     price: "$2,318",  changePct: "+0.54%", direction: "up"   },
  { symbol: "BTC",     name: "Bitcoin",  price: "$68,420", changePct: "+1.85%", direction: "up"   },
];

const DEFAULT_ARTICLES: NewsletterArticle[] = [
  {
    headline: "Fed Holds Rates, Signals Caution, Refuses to Commit to Anything Specific",
    satiricalHeadline: "Central bank opts for maximum optionality, minimum clarity.",
    excerpt: "The Federal Reserve held interest rates steady at its latest meeting, citing a complex macroeconomic environment. Officials described the path forward as 'data dependent' — central bank for 'we have no idea either'.",
    url: "https://theboardroombrief.com/markets-floor/fed-holds-rates",
    pillar: "Markets Floor",
    pillarColor: "#1e40af",
  },
  {
    headline: "NVIDIA's Enterprise AI Push Signals Spending Surge",
    satiricalHeadline: "Everyone is buying GPUs. Nobody knows exactly why.",
    excerpt: "Enterprise AI adoption accelerates as NVIDIA reports record data centre revenue.",
    url: "https://theboardroombrief.com/markets-floor/nvidia-enterprise",
    pillar: "Markets Floor",
    pillarColor: "#1e40af",
  },
  {
    headline: "China's Q1 GDP Rebound Surprises Analysts",
    satiricalHeadline: "Economists were wrong again. They are handling it with dignity.",
    excerpt: "China's economy expanded faster than forecast in the first quarter, defying expectations of a continued slowdown.",
    url: "https://theboardroombrief.com/macro-mondays/china-gdp",
    pillar: "Macro Mondays",
    pillarColor: "#7c3aed",
  },
];

const DEFAULT_WATER_COOLER: NewsletterArticle = {
  headline: "The 47-Slide Deck That Could Have Been a Bullet Point",
  satiricalHeadline: "Consultants defend their methodology. The client nods. Nobody learns anything.",
  excerpt: "An internal study has confirmed what everyone already suspected: the length of a presentation is inversely correlated with the quality of its insights.",
  url: "https://theboardroombrief.com/water-cooler/slides",
  pillar: "Water Cooler",
  pillarColor: "#b8960c",
};

function dirColor(d: "up" | "down" | "flat") {
  return d === "up" ? GREEN : d === "down" ? DKRED : MUTED;
}

function dirArrow(d: "up" | "down" | "flat") {
  return d === "up" ? "▲" : d === "down" ? "▼" : "—";
}

export default function MorningBrief({
  date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
  firstName,
  marketSnapshot = DEFAULT_MARKETS,
  articles = DEFAULT_ARTICLES,
  waterCoolerItem = DEFAULT_WATER_COOLER,
  introText = "Markets are open, inboxes are full, and somewhere a senior vice president is rescheduling a call that could have been an email. Here is what you actually need to know.",
  unsubscribeUrl = "https://theboardroombrief.com/unsubscribe",
  preferencesUrl = "https://theboardroombrief.com/preferences",
  sponsorContent,
}: Props) {
  const [leadArticle, ...restArticles] = articles;
  const greeting = firstName ? `Good morning, ${firstName}.` : "Good morning.";
  const gridArticles = restArticles.slice(0, 2);
  const listArticles = restArticles.slice(2, 4);

  return (
    <Html lang="en">
      <Head />
      <Preview>{greeting} Your Morning Brief is ready — {date}.</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: CREAM }}>

          {/* a. Masthead */}
          <Section style={{ backgroundColor: NAVY, padding: "0" }}>
            <Row>
              <Column style={{ padding: "10px 24px" }}>
                <Text style={{ color: GOLD, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "3px", textTransform: "uppercase", margin: 0 }}>
                  The Boardroom Brief
                </Text>
              </Column>
              <Column style={{ padding: "10px 24px", textAlign: "right" }}>
                <Text style={{ color: "rgba(245,240,232,0.4)", fontSize: "9px", fontFamily: "Arial, sans-serif", margin: 0 }}>
                  {date}
                </Text>
              </Column>
            </Row>
          </Section>
          <Section style={{ backgroundColor: NAVY, padding: "16px 24px 24px", borderBottom: `3px solid ${RED}` }}>
            <Heading style={{ color: CREAM, fontSize: "36px", fontFamily: "Georgia, serif", margin: "0 0 6px", fontWeight: "700", letterSpacing: "-1px" }}>
              The Morning Brief
            </Heading>
            <Text style={{ color: "rgba(245,240,232,0.5)", fontSize: "12px", fontFamily: "Arial, sans-serif", margin: 0 }}>
              Real markets. Real news. Questionable corporate poetry.
            </Text>
          </Section>

          {/* b. Personalised opener */}
          <Section style={{ padding: "28px 24px 24px", borderBottom: `1px solid ${BORDER}` }}>
            <Text style={{ color: NAVY, fontSize: "16px", fontFamily: "Georgia, serif", fontWeight: "700", margin: "0 0 10px" }}>
              {greeting}
            </Text>
            <Text style={{ color: "#333", fontSize: "15px", fontFamily: "Georgia, serif", lineHeight: "1.7", margin: 0 }}>
              {introText}
            </Text>
          </Section>

          {/* c. Market snapshot */}
          <Section style={{ padding: "20px 24px", backgroundColor: "#f0ebe0", borderBottom: `1px solid ${BORDER}` }}>
            <Text style={{ color: NAVY, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 12px" }}>
              Market Snapshot
            </Text>
            <Row>
              {marketSnapshot.slice(0, 3).map((m, i) => (
                <Column key={m.symbol} style={{ width: "33.3%", textAlign: "center", padding: "8px 4px", borderRight: i < 2 ? `1px solid ${BORDER}` : "none" }}>
                  <Text style={{ color: MUTED, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 2px" }}>
                    {m.symbol}
                  </Text>
                  <Text style={{ color: NAVY, fontSize: "14px", fontFamily: "'Courier New', monospace", fontWeight: "700", margin: "0 0 2px" }}>
                    {m.price}
                  </Text>
                  <Text style={{ color: dirColor(m.direction), fontSize: "11px", fontFamily: "'Courier New', monospace", margin: 0 }}>
                    {dirArrow(m.direction)} {m.changePct}
                  </Text>
                </Column>
              ))}
            </Row>
            {marketSnapshot.length > 3 && (
              <Row style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "8px", marginTop: "8px" }}>
                {marketSnapshot.slice(3, 6).map((m, i) => (
                  <Column key={m.symbol} style={{ width: "33.3%", textAlign: "center", padding: "8px 4px", borderRight: i < 2 ? `1px solid ${BORDER}` : "none" }}>
                    <Text style={{ color: MUTED, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 2px" }}>
                      {m.symbol}
                    </Text>
                    <Text style={{ color: NAVY, fontSize: "14px", fontFamily: "'Courier New', monospace", fontWeight: "700", margin: "0 0 2px" }}>
                      {m.price}
                    </Text>
                    <Text style={{ color: dirColor(m.direction), fontSize: "11px", fontFamily: "'Courier New', monospace", margin: 0 }}>
                      {dirArrow(m.direction)} {m.changePct}
                    </Text>
                  </Column>
                ))}
              </Row>
            )}
          </Section>

          {/* d. Divider */}
          <Section style={{ padding: "14px 24px", borderBottom: `1px solid ${BORDER}` }}>
            <Text style={{ color: MUTED, fontSize: "13px", fontFamily: "Georgia, serif", fontStyle: "italic", textAlign: "center", margin: 0 }}>
              Here is what happened while you were sleeping.
            </Text>
          </Section>

          {/* e. Lead article */}
          {leadArticle && (
            <Section style={{ padding: "28px 24px", borderBottom: `1px solid ${BORDER}` }}>
              <Text style={{ color: RED, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 14px" }}>
                Lead Story
              </Text>
              {leadArticle.imageUrl && (
                <Img
                  src={leadArticle.imageUrl}
                  alt={leadArticle.headline}
                  width="552"
                  style={{ display: "block", width: "100%", height: "auto", marginBottom: "16px", borderRadius: "2px" }}
                />
              )}
              <Heading as="h2" style={{ color: NAVY, fontSize: "24px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.25", margin: "0 0 8px" }}>
                {leadArticle.headline}
              </Heading>
              <Text style={{ color: RED, fontSize: "14px", fontFamily: "Georgia, serif", fontStyle: "italic", margin: "0 0 12px" }}>
                {leadArticle.satiricalHeadline}
              </Text>
              <Hr style={{ borderColor: BORDER, margin: "0 0 14px" }} />
              <Text style={{ color: "#333", fontSize: "15px", fontFamily: "Georgia, serif", lineHeight: "1.65", margin: "0 0 8px" }}>
                {leadArticle.excerpt}
              </Text>
              {leadArticle.author && (
                <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", margin: "0 0 16px" }}>
                  By {leadArticle.author}
                </Text>
              )}
              <Row style={{ marginBottom: "16px" }}>
                <Column>
                  <Text style={{ margin: 0 }}>
                    <span style={{ backgroundColor: leadArticle.pillarColor, color: "#fff", fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "1px", textTransform: "uppercase", padding: "3px 8px", borderRadius: "2px" }}>
                      {leadArticle.pillar}
                    </span>
                  </Text>
                </Column>
              </Row>
              <Button
                href={leadArticle.url}
                style={{ backgroundColor: RED, color: "#fff", fontFamily: "Arial, sans-serif", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", padding: "10px 20px", borderRadius: "2px", textDecoration: "none", display: "inline-block" }}
              >
                Read in full →
              </Button>
            </Section>
          )}

          {/* f. 2-column article grid */}
          {gridArticles.length > 0 && (
            <Section style={{ padding: "24px 24px 16px", borderBottom: `1px solid ${BORDER}` }}>
              <Text style={{ color: NAVY, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 16px" }}>
                Also in today's brief
              </Text>
              <Row>
                {gridArticles.map((a, i) => (
                  <Column key={a.url} style={{ width: "50%", verticalAlign: "top", paddingRight: i === 0 ? "8px" : "0", paddingLeft: i === 1 ? "8px" : "0" }}>
                    <Section style={{ backgroundColor: "#f0ebe0", padding: "16px", borderTop: `3px solid ${a.pillarColor}` }}>
                      <Text style={{ color: MUTED, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "1.5px", textTransform: "uppercase", margin: "0 0 6px" }}>
                        {a.pillar}
                      </Text>
                      <Link href={a.url} style={{ textDecoration: "none" }}>
                        <Text style={{ color: NAVY, fontSize: "14px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.3", margin: "0 0 6px" }}>
                          {a.headline}
                        </Text>
                      </Link>
                      <Text style={{ color: RED, fontSize: "11px", fontFamily: "Georgia, serif", fontStyle: "italic", margin: "0 0 8px" }}>
                        {a.satiricalHeadline}
                      </Text>
                      <Text style={{ color: "#555", fontSize: "12px", fontFamily: "Georgia, serif", lineHeight: "1.5", margin: "0 0 10px" }}>
                        {a.excerpt}
                      </Text>
                      <Link href={a.url} style={{ color: RED, fontSize: "11px", fontFamily: "Arial, sans-serif", fontWeight: "700", textDecoration: "none" }}>
                        Read more →
                      </Link>
                    </Section>
                  </Column>
                ))}
              </Row>
              {/* 3rd–4th articles as numbered list */}
              {listArticles.map((a, i) => (
                <Row key={a.url} style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${BORDER}` }}>
                  <Column style={{ width: "24px", verticalAlign: "top", paddingRight: "12px" }}>
                    <Text style={{ color: RED, fontSize: "18px", fontFamily: "Georgia, serif", fontWeight: "700", margin: 0 }}>
                      {gridArticles.length + i + 2}
                    </Text>
                  </Column>
                  <Column>
                    <Text style={{ color: MUTED, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "1.5px", textTransform: "uppercase", margin: "0 0 4px" }}>
                      {a.pillar}
                    </Text>
                    <Link href={a.url} style={{ textDecoration: "none" }}>
                      <Text style={{ color: NAVY, fontSize: "15px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.3", margin: "0 0 4px" }}>
                        {a.headline}
                      </Text>
                    </Link>
                    <Text style={{ color: RED, fontSize: "12px", fontFamily: "Georgia, serif", fontStyle: "italic", margin: 0 }}>
                      {a.satiricalHeadline}
                    </Text>
                  </Column>
                </Row>
              ))}
            </Section>
          )}

          {/* g. Optional sponsor slot */}
          {sponsorContent && (
            <Section style={{ padding: "24px", backgroundColor: "#fafaf7", border: `1px solid ${BORDER}` }}>
              <Text style={{ color: MUTED, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", margin: "0 0 12px" }}>
                From our partners
              </Text>
              {sponsorContent.logoUrl && (
                <Img src={sponsorContent.logoUrl} alt="Sponsor logo" width="120" style={{ marginBottom: "10px" }} />
              )}
              <Text style={{ color: NAVY, fontSize: "15px", fontFamily: "Georgia, serif", fontWeight: "700", margin: "0 0 8px" }}>
                {sponsorContent.headline}
              </Text>
              <Text style={{ color: "#333", fontSize: "13px", fontFamily: "Arial, sans-serif", lineHeight: "1.6", margin: "0 0 16px" }}>
                {sponsorContent.body}
              </Text>
              <Button
                href={sponsorContent.ctaUrl}
                style={{ backgroundColor: NAVY, color: "#fff", fontFamily: "Arial, sans-serif", fontSize: "11px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", padding: "10px 20px", borderRadius: "2px", textDecoration: "none", display: "inline-block" }}
              >
                {sponsorContent.ctaLabel}
              </Button>
            </Section>
          )}

          {/* h. Water Cooler */}
          <Section style={{ padding: "28px 24px", backgroundColor: "#1a2635", borderBottom: `3px solid ${RED}` }}>
            <Text style={{ color: GOLD, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 12px" }}>
              Water Cooler
            </Text>
            <Text style={{ color: CREAM, fontSize: "17px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.3", margin: "0 0 6px" }}>
              {waterCoolerItem.headline}
            </Text>
            <Text style={{ color: "rgba(245,240,232,0.65)", fontSize: "13px", fontFamily: "Georgia, serif", fontStyle: "italic", margin: "0 0 12px" }}>
              {waterCoolerItem.satiricalHeadline}
            </Text>
            <Text style={{ color: "rgba(245,240,232,0.8)", fontSize: "13px", fontFamily: "Georgia, serif", lineHeight: "1.6", margin: "0 0 16px" }}>
              {waterCoolerItem.excerpt}
            </Text>
            <Link href={waterCoolerItem.url} style={{ color: GOLD, fontSize: "11px", fontFamily: "Arial, sans-serif", fontWeight: "700", textDecoration: "none" }}>
              Read more →
            </Link>
          </Section>

          {/* i. Footer */}
          <Section style={{ padding: "20px 24px 16px", backgroundColor: "#e8e2d8" }}>
            <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: "0 0 8px" }}>
              <Link href="https://theboardroombrief.com" style={{ color: MUTED, textDecoration: "underline" }}>View in browser</Link>
              {"  ·  "}
              <Link href={preferencesUrl} style={{ color: MUTED, textDecoration: "underline" }}>Preferences</Link>
              {"  ·  "}
              <Link href={unsubscribeUrl} style={{ color: MUTED, textDecoration: "underline" }}>Unsubscribe</Link>
            </Text>
            <Text style={{ color: "#999", fontSize: "10px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: "0 0 6px" }}>
              The Boardroom Brief · 123 Example Street · London, EC2A 4PQ · United Kingdom
            </Text>
            <Text style={{ color: "#bbb", fontSize: "10px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: 0 }}>
              You're receiving this because you subscribed at theboardroombrief.com. © {new Date().getFullYear()} The Boardroom Brief.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
