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
  Row,
  Column,
} from "@react-email/components";
import type { DailyDigest } from "@/app/lib/agents/types";

const NAVY   = "#0f1923";
const CREAM  = "#f5f0e8";
const RED    = "#c8391a";
const GOLD   = "#b8960c";
const MUTED  = "#6b6558";
const BORDER = "#ddd8ce";
const SURFACE = "#ede8de";
const GREEN  = "#15803d";
const AMBER  = "#92400e";
const AMBER_BG = "#fffbeb";
const AMBER_BORDER = "#fcd34d";

const PILLAR_COLORS: Record<string, string> = {
  "markets-floor":  "#1d4ed8",
  "macro-mondays":  "#15803d",
  "c-suite-circus": "#7c3aed",
  "global-office":  "#b45309",
  "water-cooler":   "#be123c",
  "off-the-record": "#c2410c",
};

function pillarLabel(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreColor(score: number) {
  if (score >= 9) return GREEN;
  if (score >= 7) return "#1d4ed8";
  return RED;
}

interface Props {
  digest: DailyDigest;
  siteUrl?: string;
  approvalTokens?: Record<string, string>; // articleIndex → token
}

export default function DailyDigestEmail({
  digest,
  siteUrl = "https://thealignmenttimes.com",
  approvalTokens = {},
}: Props) {
  const passed = digest.articles
    .map((a, i) => ({ ...a, index: i }))
    .filter((a) => a.review.passed);

  const rejected = digest.articles
    .map((a, i) => ({ ...a, index: i }))
    .filter((a) => !a.review.passed);

  const sentTime = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const passedCount = digest.passedArticles;

  return (
    <Html lang="en">
      <Head />
      <Preview>
        {`${passedCount} article${passedCount !== 1 ? "s" : ""} ready for review — ${digest.date}`}
      </Preview>

      <Body style={{ backgroundColor: CREAM, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "640px", margin: "0 auto" }}>

          {/* ── HEADER ── */}
          <Section style={{ backgroundColor: NAVY, padding: "32px 28px 24px", borderBottom: `3px solid ${RED}` }}>
            <Heading style={{ color: CREAM, fontSize: "30px", fontFamily: "Georgia, serif", margin: "0 0 4px", fontWeight: "700", letterSpacing: "-0.5px" }}>
              The Alignment Times
            </Heading>
            <Text style={{ color: "rgba(245,240,232,0.5)", fontSize: "11px", fontFamily: "Arial, sans-serif", margin: "0 0 20px", letterSpacing: "2px", textTransform: "uppercase" }}>
              {digest.date} · Your morning digest is ready
            </Text>

            {/* Stat pills */}
            <Row>
              <Column style={{ paddingRight: "8px" }}>
                <Section style={{ backgroundColor: "rgba(255,255,255,0.08)", padding: "10px 14px", textAlign: "center" as const }}>
                  <Text style={{ color: CREAM, fontSize: "20px", fontFamily: "Georgia, serif", fontWeight: "700", margin: "0 0 2px" }}>
                    {digest.totalArticles}
                  </Text>
                  <Text style={{ color: "rgba(245,240,232,0.5)", fontSize: "10px", fontFamily: "Arial, sans-serif", margin: 0, textTransform: "uppercase" as const, letterSpacing: "1px" }}>
                    written
                  </Text>
                </Section>
              </Column>
              <Column style={{ paddingRight: "8px" }}>
                <Section style={{ backgroundColor: "rgba(21,128,61,0.25)", padding: "10px 14px", textAlign: "center" as const, border: "1px solid rgba(21,128,61,0.4)" }}>
                  <Text style={{ color: "#86efac", fontSize: "20px", fontFamily: "Georgia, serif", fontWeight: "700", margin: "0 0 2px" }}>
                    {digest.passedArticles}
                  </Text>
                  <Text style={{ color: "rgba(134,239,172,0.7)", fontSize: "10px", fontFamily: "Arial, sans-serif", margin: 0, textTransform: "uppercase" as const, letterSpacing: "1px" }}>
                    passed
                  </Text>
                </Section>
              </Column>
              <Column>
                <Section style={{ backgroundColor: "rgba(200,57,26,0.2)", padding: "10px 14px", textAlign: "center" as const, border: "1px solid rgba(200,57,26,0.35)" }}>
                  <Text style={{ color: "#fca5a5", fontSize: "20px", fontFamily: "Georgia, serif", fontWeight: "700", margin: "0 0 2px" }}>
                    {digest.rejectedArticles}
                  </Text>
                  <Text style={{ color: "rgba(252,165,165,0.7)", fontSize: "10px", fontFamily: "Arial, sans-serif", margin: 0, textTransform: "uppercase" as const, letterSpacing: "1px" }}>
                    rejected
                  </Text>
                </Section>
              </Column>
            </Row>
          </Section>

          {/* ── PASSING ARTICLES ── */}
          {passed.map(({ draft, review, index }) => {
            const token = approvalTokens[String(index)] ?? "";
            const approveUrl = `${siteUrl}/api/editorial/approve?id=${index}&token=${token}`;
            const dashUrl = `${siteUrl}/dashboard/editorial#article-${index}`;
            const pillarColor = PILLAR_COLORS[draft.pillar] ?? RED;
            const bodyPreview = draft.body.replace(/\n+/g, " ").slice(0, 300);
            const showEditorNote = review.score < 8.5;

            return (
              <Section key={index} style={{ padding: "0 28px", marginTop: "28px" }}>

                {/* Pillar accent + label */}
                <Section style={{ borderLeft: `3px solid ${pillarColor}`, paddingLeft: "10px", marginBottom: "14px" }}>
                  <Text style={{ color: pillarColor, fontSize: "10px", fontFamily: "Arial, sans-serif", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase" as const, margin: "0 0 2px" }}>
                    {pillarLabel(draft.pillar)}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", margin: 0 }}>
                    {draft.agentName} &nbsp;·&nbsp;
                    <span style={{ color: scoreColor(review.score), fontWeight: "700" }}>
                      {review.score}/10
                    </span>
                  </Text>
                </Section>

                {/* Headline */}
                <Heading as="h2" style={{ color: NAVY, fontSize: "22px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.25", margin: "0 0 6px" }}>
                  {draft.headline}
                </Heading>
                <Text style={{ color: MUTED, fontSize: "14px", fontFamily: "Georgia, serif", fontStyle: "italic", lineHeight: "1.5", margin: "0 0 14px" }}>
                  {draft.satiricalHeadline}
                </Text>

                {/* Editor note — only shown when score < 8.5 */}
                {showEditorNote && (
                  <Section style={{ backgroundColor: AMBER_BG, border: `1px solid ${AMBER_BORDER}`, padding: "10px 14px", marginBottom: "14px" }}>
                    <Text style={{ color: AMBER, fontSize: "10px", fontFamily: "Arial, sans-serif", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase" as const, margin: "0 0 4px" }}>
                      Editor note
                    </Text>
                    <Text style={{ color: "#78350f", fontSize: "13px", fontFamily: "Georgia, serif", fontStyle: "italic", lineHeight: "1.6", margin: 0 }}>
                      {review.notes}
                    </Text>
                  </Section>
                )}

                {/* Body preview */}
                <Text style={{ color: "#333", fontSize: "14px", fontFamily: "Georgia, serif", lineHeight: "1.75", margin: "0 0 6px" }}>
                  {bodyPreview}
                  {draft.body.length > 300 ? "…" : ""}
                </Text>

                {/* Tags */}
                {draft.tags && draft.tags.length > 0 && (
                  <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", margin: "8px 0 16px" }}>
                    {draft.tags.map((t) => `#${t}`).join("  ·  ")}
                  </Text>
                )}

                {/* Action buttons */}
                <Row style={{ marginTop: "16px" }}>
                  <Column style={{ paddingRight: "10px" }}>
                    <Button
                      href={approveUrl}
                      style={{ backgroundColor: GREEN, color: "#fff", fontFamily: "Arial, sans-serif", fontSize: "12px", fontWeight: "700", letterSpacing: "0.5px", textTransform: "uppercase" as const, padding: "13px 20px", borderRadius: "2px", textDecoration: "none", display: "block", textAlign: "center" as const }}
                    >
                      ✓ Approve + publish
                    </Button>
                  </Column>
                  <Column>
                    <Button
                      href={dashUrl}
                      style={{ backgroundColor: "transparent", color: NAVY, fontFamily: "Arial, sans-serif", fontSize: "12px", fontWeight: "700", letterSpacing: "0.5px", textTransform: "uppercase" as const, padding: "12px 20px", borderRadius: "2px", textDecoration: "none", display: "block", textAlign: "center" as const, border: `1px solid ${BORDER}` }}
                    >
                      Open in dashboard →
                    </Button>
                  </Column>
                </Row>

                <Hr style={{ borderColor: BORDER, margin: "28px 0 0" }} />
              </Section>
            );
          })}

          {/* ── REJECTED SECTION ── */}
          {rejected.length > 0 && (
            <Section style={{ padding: "20px 28px" }}>
              <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase" as const, margin: "0 0 12px" }}>
                Editor in chief rejected {rejected.length} article{rejected.length !== 1 ? "s" : ""} — not sent for human review
              </Text>
              {rejected.map(({ draft, review, index }) => (
                <Section key={index} style={{ marginBottom: "8px", padding: "10px 12px", backgroundColor: SURFACE, borderLeft: `2px solid ${RED}` }}>
                  <Row>
                    <Column>
                      <Text style={{ color: NAVY, fontSize: "13px", fontFamily: "Georgia, serif", fontWeight: "700", margin: "0 0 2px" }}>
                        {draft.headline}
                      </Text>
                      <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", margin: 0 }}>
                        {draft.agentName} · Score: <span style={{ color: RED, fontWeight: "700" }}>{review.score}/10</span> · {review.notes.slice(0, 100)}{review.notes.length > 100 ? "…" : ""}
                      </Text>
                    </Column>
                  </Row>
                </Section>
              ))}
            </Section>
          )}

          {/* ── FOOTER ── */}
          <Section style={{ padding: "20px 28px 28px", backgroundColor: "#e8e2d8", borderTop: `1px solid ${BORDER}` }}>
            <Text style={{ color: MUTED, fontSize: "12px", fontFamily: "Arial, sans-serif", textAlign: "center" as const, margin: "0 0 10px" }}>
              <a href={`${siteUrl}/dashboard/editorial`} style={{ color: RED, textDecoration: "none" }}>Dashboard</a>
              {"  ·  "}
              <a href={`${siteUrl}/dashboard/editorial`} style={{ color: MUTED, textDecoration: "none" }}>News feed</a>
              {"  ·  "}
              <a href={`${siteUrl}/api/newsroom/run`} style={{ color: MUTED, textDecoration: "none" }}>Run pipeline</a>
              {"  ·  "}
              <a href={`${siteUrl}/dashboard`} style={{ color: MUTED, textDecoration: "none" }}>Settings</a>
            </Text>
            <Text style={{ color: "#aaa5a0", fontSize: "10px", fontFamily: "Arial, sans-serif", textAlign: "center" as const, margin: 0 }}>
              Sent at {sentTime} · The Alignment Times · Internal editorial use only
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
