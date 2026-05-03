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

const NAVY   = "#0f1923";
const CREAM  = "#f5f0e8";
const RED    = "#c8391a";
const MUTED  = "#666666";
const BORDER = "#ddd8ce";
const SURFACE = "#ede8de";

interface CommentReplyProps {
  parentAuthorName?: string;
  parentBody?: string;
  replyAuthorName?: string;
  replyBody?: string;
  articleTitle?: string;
  articleUrl?: string;
  commentId?: string;
}

export default function CommentReply({
  parentAuthorName = "Reader",
  parentBody = "Your original comment here.",
  replyAuthorName = "Another reader",
  replyBody = "Their reply here.",
  articleTitle = "Article Title",
  articleUrl = "https://theboardroombrief.com",
  commentId = "",
}: CommentReplyProps) {
  const readUrl = commentId ? `${articleUrl}#comment-${commentId}` : articleUrl;

  return (
    <Html lang="en">
      <Head />
      <Preview>{replyAuthorName} replied to your comment on The Boardroom Brief</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: CREAM }}>

          {/* Masthead */}
          <Section style={{ backgroundColor: NAVY, padding: "24px 24px", borderBottom: `3px solid ${RED}` }}>
            <Heading style={{ color: CREAM, fontSize: "22px", fontFamily: "Georgia, serif", margin: "0 0 4px", fontWeight: "700" }}>
              The Boardroom Brief
            </Heading>
            <Text style={{ color: "rgba(245,240,232,0.5)", fontSize: "11px", fontFamily: "Arial, sans-serif", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Comment Notification
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: "32px 24px" }}>
            <Heading as="h2" style={{ color: NAVY, fontSize: "20px", fontFamily: "Georgia, serif", fontWeight: "700", lineHeight: "1.3", margin: "0 0 6px" }}>
              Someone replied to your comment
            </Heading>
            <Text style={{ color: MUTED, fontSize: "13px", fontFamily: "Arial, sans-serif", margin: "0 0 24px" }}>
              on <strong style={{ color: NAVY }}>{articleTitle}</strong>
            </Text>

            <Hr style={{ borderColor: BORDER, margin: "0 0 20px" }} />

            {/* Original comment */}
            <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
              Your comment
            </Text>
            <Section style={{ backgroundColor: SURFACE, borderLeft: `3px solid ${BORDER}`, padding: "12px 16px", margin: "0 0 20px" }}>
              <Text style={{ color: "#444", fontSize: "14px", fontFamily: "Georgia, serif", lineHeight: "1.65", margin: 0, fontStyle: "italic" }}>
                "{parentBody}"
              </Text>
              <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", margin: "8px 0 0" }}>
                — {parentAuthorName}
              </Text>
            </Section>

            {/* Reply */}
            <Text style={{ color: MUTED, fontSize: "11px", fontFamily: "Arial, sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
              {replyAuthorName} replied
            </Text>
            <Section style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, padding: "14px 16px", margin: "0 0 28px" }}>
              <Text style={{ color: NAVY, fontSize: "14px", fontFamily: "Georgia, serif", lineHeight: "1.65", margin: 0 }}>
                {replyBody}
              </Text>
            </Section>

            <Button
              href={readUrl}
              style={{
                backgroundColor: RED,
                color: "#fff",
                fontFamily: "Arial, sans-serif",
                fontSize: "12px",
                fontWeight: "700",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "12px 24px",
                borderRadius: "2px",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Read the discussion →
            </Button>
          </Section>

          {/* Footer */}
          <Section style={{ padding: "16px 24px", backgroundColor: "#e8e2d8", borderTop: `1px solid ${BORDER}` }}>
            <Text style={{ color: "#aaa", fontSize: "10px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: "0 0 4px" }}>
              You received this because you commented on The Boardroom Brief.
            </Text>
            <Text style={{ color: "#aaa", fontSize: "10px", fontFamily: "Arial, sans-serif", textAlign: "center", margin: 0 }}>
              To stop receiving reply notifications, update your{" "}
              <a href={`${articleUrl?.split("/").slice(0, 3).join("/")}/settings`} style={{ color: "#aaa" }}>
                notification preferences
              </a>
              .
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
