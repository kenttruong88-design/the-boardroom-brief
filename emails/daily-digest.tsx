import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { DailyDigest } from "@/app/lib/agents/types";

const NAVY   = "#0f1923";
const CREAM  = "#f5f0e8";
const RED    = "#c8391a";
const MUTED  = "#666666";
const BORDER = "#ddd8ce";
const GREEN  = "#15803d";
const BLUE   = "#1d4ed8";
const SURFACE = "#ede8de";

interface Props {
  digest: DailyDigest;
  siteUrl?: string;
}

function scoreColor(score: number) {
  if (score >= 9) return GREEN;
  if (score >= 7) return BLUE;
  return RED;
}

function pillarLabel(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DailyDigestEmail({
  digest,
  siteUrl = "https://thealignmenttimes.com",
}: Props) {
  const passed = digest.articles.filter((a) => a.review.passed);
  const rejected = digest.articles.filter((a) => !a.review.passed);
  const subject = `Boardroom Brief — ${passed.length} article${passed.length !== 1 ? "s" : ""} ready for review — ${digest.date}`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "680px", margin: "0 auto", backgroundColor: CREAM }}>

          {/* Masthead */}
          <Section style={{ backgroundColor: NAVY, padding: "28px 24px", borderBottom: `3px solid ${RED}` }}>
            <Heading style={{ color: CREAM, fontSize: "26px", fontFamily: "Georgia, serif", margin: "0 0 6px", fontWeight: "700" }}>
              The Alignment Times
            </Heading>
            <Text style={{ color: "rgba(245,240,232,0.55)", fontSize: "11px", fontFamily: "Arial, sans-serif", margin: 0, letterSpacing: "1px", textTransform: "uppercase" }}>
              Daily Editorial Digest — {digest.date}
            </Text>
          </Section>

          {/* Summary bar */}
          <Section style={{ backgroundColor: SURFACE, padding: "16px 24px", borderBottom: `1px solid ${BORDER}` }}>
            <Text style={{ color: NAVY, fontSize: "13px", fontFamily: "Arial, sans-serif", margin: 0 }}>
              <strong>{digest.totalArticles}</strong> written &nbsp;·&nbsp;
              <strong style={{ color: GREEN }}>{digest.passedArticles}</strong> passed &nbsp;·&nbsp;
              <strong style={{ color: RED }}>{digest.rejectedArticles}</strong> rejected
            </Text>
          </Section>

          {/* Passed articles */}
          {passed.length > 0 && (
            <Section style={{ padding: "0 24px" }}>
              <Heading as="h2" style={{ color: NAVY, fontSize: "13px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", margin: "28px 0 16px", fontWeight: "700" }}>
                Ready for Review
              </Heading>

              {passed.map(({ draft, review }, i) => (
                <Section key={i} style={{ marginBottom: "32px", borderTop: `2px solid ${NAVY}`, paddingTop: "20px" }}>
                  {/* Pillar badge + agent */}
                  <Text style={{ color: RED, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", margin: "0 0 6px", fontWeight: "700" }}>
                    {pillarLabel(draft.pillar)} &nbsp;·&nbsp; {draft.agentName}
                  </Text>

                  {/* Headline */}
                  <Heading as="h3" style={{ color: NAVY, fontSize: "20px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.25", margin: "0 0 6px" }}>
                    {draft.headline}
                  </Heading>
                  <Text style={{ color: MUTED, fontSize: "14px", fontFamily: "Georgia, serif", fontStyle: "italic", margin: "0 0 14px" }}>
                    {draft.satiricalHeadline}
                  </Text>

                  {/* Score */}
                  <Text style={{ color: scoreColor(review.score), fontSize: "13px", fontFamily: "Arial, sans-serif", fontWeight: "700", margin: "0 0 10px" }}>
                    Editor score: {review.score}/10
                  </Text>

                  {/* Editor notes callout */}
                  <Section style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, padding: "12px 16px", marginBottom: "14px" }}>
                    <Text style={{ color: "#444", fontSize: "13px", fontFamily: "Georgia, serif", lineHeight: "1.6", margin: 0 }}>
                      <em>{review.notes}</em>
                    </Text>
                  </Section>

                  {/* Body preview */}
                  <Text style={{ color: "#333", fontSize: "14px", fontFamily: "Georgia, serif", lineHeight: "1.7", margin: "0 0 18px" }}>
                    {draft.body.split("\n\n")[0]}
                  </Text>

                  {/* Action buttons */}
                  <Section>
                    <Button
                      href={`${siteUrl}/dashboard/editorial?action=approve&id=${i}`}
                      style={{ backgroundColor: GREEN, color: "#fff", fontFamily: "Arial, sans-serif", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", padding: "12px 20px", borderRadius: "2px", textDecoration: "none", display: "inline-block", marginRight: "10px" }}
                    >
                      Approve + Publish
                    </Button>
                    <Button
                      href={`${siteUrl}/studio`}
                      style={{ backgroundColor: "transparent", color: NAVY, fontFamily: "Arial, sans-serif", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", padding: "11px 20px", borderRadius: "2px", textDecoration: "none", display: "inline-block", border: `1px solid ${BORDER}` }}
                    >
                      Edit in Sanity
                    </Button>
                  </Section>
                </Section>
              ))}
            </Section>
          )}

          <Hr style={{ borderColor: BORDER, margin: "0 24px" }} />

          {/* Rejected articles */}
          {rejected.length > 0 && (
            <Section style={{ padding: "20px 24px" }}>
              <Heading as="h2" style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", letterSpacing: "2px", textTransform: "uppercase", margin: "0 0 14px", fontWeight: "700" }}>
                Not passing ({rejected.length})
              </Heading>
              {rejected.map(({ draft, review }, i) => (
                <Section key={i} style={{ marginBottom: "12px", padding: "12px 16px", border: `1px solid ${BORDER}` }}>
                  <Text style={{ color: MUTED, fontSize: "10px", fontFamily: "Arial, sans-serif", letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 4px" }}>
                    {pillarLabel(draft.pillar)} &nbsp;·&nbsp; Score: {review.score}/10
                  </Text>
                  <Text style={{ color: NAVY, fontSize: "14px", fontFamily: "Georgia, serif", fontWeight: "700", margin: "0 0 4px" }}>
                    {draft.headline}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: "12px", fontFamily: "Arial, sans-serif", margin: 0 }}>
                    {review.notes}
                  </Text>
                </Section>
              ))}
            </Section>
          )}

          {/* Footer */}
          <Section style={{ padding: "20px 24px", backgroundColor: "#e8e2d8", borderTop: `1px solid ${BORDER}` }}>
            <Text style={{ color: MUTED, fontSize: "12px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: "0 0 8px" }}>
              <a href={`${siteUrl}/dashboard/editorial`} style={{ color: RED, textDecoration: "none" }}>
                Open full review dashboard →
              </a>
            </Text>
            <Text style={{ color: "#aaa", fontSize: "10px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: 0 }}>
              © {new Date().getFullYear()} The Alignment Times. Internal editorial use only.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
