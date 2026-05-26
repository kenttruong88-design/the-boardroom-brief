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

interface Props {
  firstName?: string;
  resubscribeUrl: string;
  feedbackUrl?: string;
  siteUrl?: string;
}

export default function NewsletterUnsubscribe({
  firstName,
  resubscribeUrl = "https://alignmenttimes.com/subscribe",
  feedbackUrl = "https://alignmenttimes.com/feedback",
  siteUrl = "https://alignmenttimes.com",
}: Props) {
  const headline = firstName
    ? `${firstName}, consider this your exit interview.`
    : "Consider this your exit interview.";

  return (
    <Html lang="en">
      <Head />
      <Preview>You've been unsubscribed from The Alignment Times.</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: CREAM }}>

          {/* Masthead */}
          <Section style={{ backgroundColor: NAVY, padding: "28px 24px 24px", borderBottom: `3px solid ${RED}` }}>
            <Text style={{ color: GOLD, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "3px", textTransform: "uppercase", margin: "0 0 10px" }}>
              The Alignment Times
            </Text>
            <Heading style={{ color: CREAM, fontSize: "30px", fontFamily: "Georgia, serif", margin: "0 0 6px", fontWeight: "700", letterSpacing: "-0.5px" }}>
              You've been unsubscribed.
            </Heading>
            <Text style={{ color: "rgba(245,240,232,0.5)", fontSize: "12px", fontFamily: "Arial, sans-serif", margin: 0 }}>
              Real markets. Real news. Questionable corporate poetry.
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: "40px 32px 32px" }}>
            <Text style={{ color: GOLD, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 16px" }}>
              Confirmed
            </Text>
            <Heading as="h2" style={{ color: NAVY, fontSize: "24px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.25", margin: "0 0 8px" }}>
              {headline}
            </Heading>
            <Hr style={{ borderColor: BORDER, margin: "0 0 24px" }} />
            <Text style={{ color: "#333", fontSize: "15px", fontFamily: "Georgia, serif", lineHeight: "1.7", margin: "0 0 16px" }}>
              You've been removed from The Alignment Times mailing list. No further Morning Briefs will be sent to this address.
            </Text>
            <Text style={{ color: "#333", fontSize: "15px", fontFamily: "Georgia, serif", lineHeight: "1.7", margin: "0 0 32px" }}>
              Changed your mind? You can resubscribe at any time — no hard feelings, and no onboarding call required.
            </Text>

            <Button
              href={resubscribeUrl}
              style={{
                backgroundColor: RED,
                color: "#fff",
                fontFamily: "Arial, sans-serif",
                fontSize: "12px",
                fontWeight: "700",
                letterSpacing: "1px",
                textTransform: "uppercase",
                padding: "12px 24px",
                borderRadius: "2px",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Resubscribe →
            </Button>
          </Section>

          {/* Feedback section */}
          <Section style={{ padding: "24px 32px", backgroundColor: "#f0ebe0", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
            <Text style={{ color: NAVY, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 10px" }}>
              One last thing
            </Text>
            <Text style={{ color: "#333", fontSize: "14px", fontFamily: "Georgia, serif", lineHeight: "1.6", margin: "0 0 14px" }}>
              We'd genuinely like to know why you're leaving — even if the answer is "too many emails" or "I never actually subscribed." It takes 30 seconds.
            </Text>
            <Link
              href={feedbackUrl}
              style={{ color: RED, fontSize: "13px", fontFamily: "Arial, sans-serif", fontWeight: "700", textDecoration: "none" }}
            >
              Leave feedback →
            </Link>
          </Section>

          {/* Footer */}
          <Section style={{ padding: "20px 24px", backgroundColor: "#e8e2d8" }}>
            <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: "0 0 8px" }}>
              <Link href={siteUrl} style={{ color: MUTED, textDecoration: "underline" }}>Visit site</Link>
              {"  ·  "}
              <Link href={`${siteUrl}/privacy`} style={{ color: MUTED, textDecoration: "underline" }}>Privacy</Link>
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
