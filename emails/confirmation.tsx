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

const NAVY  = "#0f1923";
const CREAM = "#f5f0e8";
const RED   = "#c8391a";
const MUTED = "#666666";
const BORDER = "#ddd8ce";

interface ConfirmationProps {
  confirmUrl?: string;
  email?: string;
}

export default function Confirmation({
  confirmUrl = "https://theboardroombrief.com/api/confirm?token=example",
  email = "you@example.com",
}: ConfirmationProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>One click to confirm — then the briefings begin.</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: CREAM }}>

          {/* Masthead */}
          <Section style={{ backgroundColor: NAVY, padding: "28px 24px", borderBottom: `3px solid ${RED}` }}>
            <Heading style={{ color: CREAM, fontSize: "28px", fontFamily: "Georgia, serif", margin: "0 0 6px", fontWeight: "700" }}>
              The Boardroom Brief
            </Heading>
            <Text style={{ color: "rgba(245,240,232,0.55)", fontSize: "12px", fontFamily: "Arial, sans-serif", margin: 0 }}>
              Executive intelligence for leaders who shape the global economy.
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: "36px 24px" }}>
            <Heading as="h2" style={{ color: NAVY, fontSize: "24px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.3", margin: "0 0 12px" }}>
              Almost there. Confirm your subscription.
            </Heading>
            <Hr style={{ borderColor: BORDER, margin: "0 0 20px" }} />
            <Text style={{ color: "#333", fontSize: "15px", fontFamily: "Georgia, serif", lineHeight: "1.7", margin: "0 0 8px" }}>
              We received a subscription request for <strong>{email}</strong>.
            </Text>
            <Text style={{ color: "#333", fontSize: "15px", fontFamily: "Georgia, serif", lineHeight: "1.7", margin: "0 0 28px" }}>
              Click the button below to confirm and start receiving The Boardroom Brief every morning. This link expires in 24 hours.
            </Text>
            <Button
              href={confirmUrl}
              style={{ backgroundColor: RED, color: "#fff", fontFamily: "Arial, sans-serif", fontSize: "13px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", padding: "14px 28px", borderRadius: "2px", textDecoration: "none", display: "inline-block" }}
            >
              Confirm subscription →
            </Button>
            <Text style={{ color: MUTED, fontSize: "12px", fontFamily: "Arial, sans-serif", lineHeight: "1.6", margin: "24px 0 0" }}>
              If you didn't sign up, ignore this email. Nothing will happen.
              If you're having trouble with the button, copy and paste this URL into your browser:
            </Text>
            <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "'Courier New', monospace", wordBreak: "break-all", margin: "8px 0 0" }}>
              {confirmUrl}
            </Text>
          </Section>

          {/* Footer */}
          <Section style={{ padding: "20px 24px", backgroundColor: "#e8e2d8", borderTop: `1px solid ${BORDER}` }}>
            <Text style={{ color: "#aaa", fontSize: "10px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: 0 }}>
              © {new Date().getFullYear()} The Boardroom Brief. Real markets. Real news. Questionable corporate poetry.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
