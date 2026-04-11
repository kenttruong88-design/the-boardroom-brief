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
const GOLD  = "#b8960c";
const MUTED = "#666666";
const BORDER = "#ddd8ce";

interface WelcomeProps {
  preferencesUrl?: string;
  siteUrl?: string;
}

export default function Welcome({
  preferencesUrl = "https://thealignmenttimes.com/welcome",
  siteUrl = "https://thealignmenttimes.com",
}: WelcomeProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to The Alignment Times — your daily executive intelligence starts tomorrow.</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: CREAM }}>

          {/* Masthead */}
          <Section style={{ backgroundColor: NAVY, padding: "28px 24px", borderBottom: `3px solid ${RED}` }}>
            <Heading style={{ color: CREAM, fontSize: "28px", fontFamily: "Georgia, serif", margin: "0 0 6px", fontWeight: "700" }}>
              The Alignment Times
            </Heading>
            <Text style={{ color: "rgba(245,240,232,0.55)", fontSize: "12px", fontFamily: "Arial, sans-serif", margin: 0 }}>
              Executive intelligence for leaders who shape the global economy.
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: "32px 24px" }}>
            <Text style={{ color: GOLD, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 16px" }}>
              Welcome aboard
            </Text>
            <Heading as="h2" style={{ color: NAVY, fontSize: "26px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.25", margin: "0 0 16px" }}>
              You're in. Your first brief arrives tomorrow morning.
            </Heading>
            <Hr style={{ borderColor: BORDER, margin: "0 0 20px" }} />
            <Text style={{ color: "#333", fontSize: "15px", fontFamily: "Georgia, serif", lineHeight: "1.7", margin: "0 0 16px" }}>
              Every weekday morning you'll receive five stories that matter — markets, macro, executive moves, and the occasional observation about corporate life that we're fairly sure nobody asked for.
            </Text>
            <Text style={{ color: "#333", fontSize: "15px", fontFamily: "Georgia, serif", lineHeight: "1.7", margin: "0 0 24px" }}>
              While you wait, tell us what you care about. We'll tailor your brief accordingly.
            </Text>
            <Button
              href={preferencesUrl}
              style={{ backgroundColor: RED, color: "#fff", fontFamily: "Arial, sans-serif", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", padding: "12px 24px", borderRadius: "2px", textDecoration: "none", display: "inline-block" }}
            >
              Set my preferences →
            </Button>
          </Section>

          {/* What to expect */}
          <Section style={{ padding: "24px", backgroundColor: "#f0ebe0", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
            <Text style={{ color: NAVY, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", margin: "0 0 16px" }}>
              What to expect
            </Text>
            {[
              ["Markets Floor", "Rates, equities, and central bank theatre."],
              ["Macro Mondays", "The global economy, explained without the jargon."],
              ["C-Suite Circus", "Leadership moves, M&A, and corporate strategy."],
              ["Global Office", "Cross-border business and 30 economies in focus."],
              ["Water Cooler", "Because someone has to say it."],
            ].map(([title, desc]) => (
              <Text key={title} style={{ color: "#333", fontSize: "13px", fontFamily: "Arial, sans-serif", margin: "0 0 8px" }}>
                <span style={{ color: NAVY, fontWeight: "700" }}>{title}</span> — {desc}
              </Text>
            ))}
          </Section>

          {/* Footer */}
          <Section style={{ padding: "20px 24px", backgroundColor: "#e8e2d8" }}>
            <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: "0 0 8px" }}>
              <Link href={`${siteUrl}/unsubscribe`} style={{ color: MUTED, textDecoration: "underline" }}>Unsubscribe</Link>
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
