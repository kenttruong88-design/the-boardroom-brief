import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const NAVY   = "#0f1923";
const CREAM  = "#f5f0e8";
const RED    = "#c8391a";
const GOLD   = "#b8960c";
const MUTED  = "#666666";
const BORDER = "#ddd8ce";

interface SampleArticle {
  headline: string;
  satiricalHeadline: string;
  url: string;
}

interface Props {
  firstName?: string;
  preferencesUrl: string;
  sampleArticle: SampleArticle;
}

export default function NewsletterWelcome({
  firstName,
  preferencesUrl = "https://alignmenttimes.com/preferences",
  sampleArticle = {
    headline: "Fed Holds Rates, Signals Caution, Refuses to Commit to Anything Specific",
    satiricalHeadline: "Central bank opts for maximum optionality, minimum clarity.",
    url: "https://alignmenttimes.com",
  },
}: Props) {
  const headline = firstName
    ? `${firstName}, you're in.`
    : "You're in.";

  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to The Alignment Times. The quarterly review starts Monday.</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: CREAM }}>

          {/* Masthead */}
          <Section style={{ backgroundColor: NAVY, padding: "28px 24px 24px", borderBottom: `3px solid ${RED}` }}>
            <Text style={{ color: GOLD, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "3px", textTransform: "uppercase", margin: "0 0 10px" }}>
              The Alignment Times
            </Text>
            <Heading style={{ color: CREAM, fontSize: "30px", fontFamily: "Georgia, serif", margin: "0 0 6px", fontWeight: "700", letterSpacing: "-0.5px" }}>
              Welcome to the Brief
            </Heading>
            <Text style={{ color: "rgba(245,240,232,0.5)", fontSize: "12px", fontFamily: "Arial, sans-serif", margin: 0 }}>
              Real markets. Real news. Questionable corporate poetry.
            </Text>
          </Section>

          {/* Hero */}
          <Section style={{ padding: "36px 32px 28px" }}>
            <Heading as="h2" style={{ color: NAVY, fontSize: "26px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.25", margin: "0 0 8px" }}>
              {headline} The quarterly review starts Monday.
            </Heading>
            <Hr style={{ borderColor: BORDER, margin: "0 0 24px" }} />
            <Text style={{ color: "#333", fontSize: "15px", fontFamily: "Georgia, serif", lineHeight: "1.7", margin: "0 0 20px" }}>
              Every weekday morning you'll receive:
            </Text>

            {[
              ["Market snapshot", "Key indices, forex, and overnight moves — in 30 seconds."],
              ["Top 3 articles", "From our five content pillars: Markets Floor, Macro Mondays, C-Suite Circus, Global Office, and Water Cooler."],
              ["One Water Cooler item", "To share with colleagues and look informed at the 9 AM stand-up."],
            ].map(([title, desc]) => (
              <Text key={title} style={{ color: "#333", fontSize: "14px", fontFamily: "Arial, sans-serif", lineHeight: "1.6", margin: "0 0 10px" }}>
                <span style={{ color: NAVY, fontWeight: "700" }}>— {title}</span>
                {"  "}
                <span style={{ color: MUTED }}>{desc}</span>
              </Text>
            ))}
          </Section>

          {/* Sample article card */}
          <Section style={{ padding: "0 32px 28px" }}>
            <Text style={{ color: NAVY, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 12px" }}>
              A taste of what's coming
            </Text>
            <Section style={{ backgroundColor: "#f0ebe0", padding: "20px", border: `1px solid ${BORDER}`, borderLeft: `3px solid ${RED}` }}>
              <Text style={{ color: MUTED, fontSize: "9px", fontFamily: "Arial, sans-serif", letterSpacing: "1.5px", textTransform: "uppercase", margin: "0 0 8px" }}>
                Markets Floor
              </Text>
              <Link href={sampleArticle.url} style={{ textDecoration: "none" }}>
                <Text style={{ color: NAVY, fontSize: "16px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.3", margin: "0 0 6px" }}>
                  {sampleArticle.headline}
                </Text>
              </Link>
              <Text style={{ color: RED, fontSize: "13px", fontFamily: "Georgia, serif", fontStyle: "italic", margin: 0 }}>
                {sampleArticle.satiricalHeadline}
              </Text>
            </Section>
          </Section>

          {/* CTA */}
          <Section style={{ padding: "0 32px 36px" }}>
            <Button
              href={preferencesUrl}
              style={{
                backgroundColor: RED,
                color: "#fff",
                fontFamily: "Arial, sans-serif",
                fontSize: "12px",
                fontWeight: "700",
                letterSpacing: "1px",
                textTransform: "uppercase",
                padding: "14px 28px",
                borderRadius: "2px",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Customise my preferences →
            </Button>
          </Section>

          {/* Add to contacts nudge */}
          <Section style={{ padding: "20px 32px", backgroundColor: "#f0ebe0", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
            <Text style={{ color: NAVY, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 8px" }}>
              Avoid the spam folder
            </Text>
            <Text style={{ color: "#333", fontSize: "13px", fontFamily: "Arial, sans-serif", lineHeight: "1.6", margin: 0 }}>
              Add <strong>hello@alignmenttimes.com</strong> to your contacts. It takes 10 seconds and ensures the Brief lands in your inbox, not the quarterly bin.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={{ padding: "20px 24px", backgroundColor: "#e8e2d8" }}>
            <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: "0 0 8px" }}>
              <Link href={preferencesUrl} style={{ color: MUTED, textDecoration: "underline" }}>Manage preferences</Link>
              {"  ·  "}
              <Link href="https://alignmenttimes.com/unsubscribe" style={{ color: MUTED, textDecoration: "underline" }}>Unsubscribe</Link>
              {"  ·  "}
              <Link href="https://alignmenttimes.com" style={{ color: MUTED, textDecoration: "underline" }}>Visit site</Link>
            </Text>
            <Text style={{ color: "#aaa", fontSize: "10px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: 0 }}>
              © {new Date().getFullYear()} The Alignment Times. All rights reserved.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
