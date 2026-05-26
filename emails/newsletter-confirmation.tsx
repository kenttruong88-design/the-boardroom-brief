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
  confirmUrl: string;
  previewText: string;
}

export default function NewsletterConfirmation({
  firstName,
  confirmUrl = "https://alignmenttimes.com/api/confirm?token=example",
  previewText = "One click to confirm — then the Morning Brief begins.",
}: Props) {
  const greeting = firstName ? `Hello, ${firstName}.` : "Hello.";

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: CREAM }}>

          {/* Masthead */}
          <Section style={{ backgroundColor: NAVY, padding: "28px 24px 24px", borderBottom: `3px solid ${RED}` }}>
            <Text style={{ color: GOLD, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "3px", textTransform: "uppercase", margin: "0 0 10px" }}>
              The Alignment Times
            </Text>
            <Heading style={{ color: CREAM, fontSize: "30px", fontFamily: "Georgia, serif", margin: "0 0 6px", fontWeight: "700", letterSpacing: "-0.5px" }}>
              The Morning Brief
            </Heading>
            <Text style={{ color: "rgba(245,240,232,0.5)", fontSize: "12px", fontFamily: "Arial, sans-serif", margin: 0 }}>
              Real markets. Real news. Questionable corporate poetry.
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: "40px 32px" }}>
            <Text style={{ color: GOLD, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 16px" }}>
              Subscription confirmation
            </Text>
            <Heading as="h2" style={{ color: NAVY, fontSize: "26px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.25", margin: "0 0 8px" }}>
              You're one step away.
            </Heading>
            <Hr style={{ borderColor: BORDER, margin: "0 0 24px" }} />
            <Text style={{ color: "#333", fontSize: "15px", fontFamily: "Georgia, serif", lineHeight: "1.7", margin: "0 0 16px" }}>
              {greeting} The Alignment Times delivers daily financial news with a dry corporate culture twist — real markets, real news, questionable corporate poetry.
            </Text>
            <Text style={{ color: "#333", fontSize: "15px", fontFamily: "Georgia, serif", lineHeight: "1.7", margin: "0 0 36px" }}>
              Confirm your email to start receiving the Morning Brief every weekday at 7 AM.
            </Text>

            <Button
              href={confirmUrl}
              style={{
                backgroundColor: RED,
                color: "#fff",
                fontFamily: "Arial, sans-serif",
                fontSize: "13px",
                fontWeight: "700",
                letterSpacing: "1px",
                textTransform: "uppercase",
                padding: "16px 32px",
                borderRadius: "2px",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Confirm my subscription →
            </Button>

            <Text style={{ color: MUTED, fontSize: "12px", fontFamily: "Arial, sans-serif", lineHeight: "1.6", margin: "28px 0 0" }}>
              This link expires in 24 hours. If you didn't subscribe, ignore this email — nothing will happen.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={{ padding: "20px 24px", backgroundColor: "#e8e2d8", borderTop: `1px solid ${BORDER}` }}>
            <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: "0 0 8px" }}>
              <Link href="https://alignmenttimes.com" style={{ color: MUTED, textDecoration: "underline" }}>The Alignment Times</Link>
              {"  ·  "}
              <Link href="https://alignmenttimes.com/unsubscribe" style={{ color: MUTED, textDecoration: "underline" }}>Unsubscribe</Link>
              {"  ·  "}
              <Link href="https://alignmenttimes.com/privacy" style={{ color: MUTED, textDecoration: "underline" }}>Privacy</Link>
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
