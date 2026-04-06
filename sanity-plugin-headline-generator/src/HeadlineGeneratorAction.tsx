import { useState } from "react";
import { useToast } from "@sanity/ui";
import { type DocumentActionProps } from "sanity";

// Extracts plain text from Sanity portable text blocks
function blocksToText(blocks: unknown[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b: unknown) => (b as { _type: string })._type === "block")
    .map((b: unknown) => {
      const block = b as { children?: { text?: string }[] };
      return (block.children ?? []).map((c) => c.text ?? "").join("");
    })
    .join(" ")
    .slice(0, 200);
}

export function HeadlineGeneratorAction(props: DocumentActionProps) {
  const { draft, published } = props;
  const doc = (draft ?? published) as Record<string, unknown> | null;
  const [loading, setLoading] = useState(false);
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  async function generate() {
    if (!doc) return;
    setLoading(true);
    setOpen(true);
    setHeadlines([]);

    try {
      const headline = (doc.title as string) ?? "";
      const excerpt =
        typeof doc.excerpt === "string"
          ? doc.excerpt
          : blocksToText((doc.body as unknown[]) ?? []);
      const pillar = (doc.pillar as { name?: string } | null)?.name ?? "";
      const countries = ((doc.countries as { name?: string }[]) ?? [])
        .map((c) => c.name)
        .filter(Boolean);

      const siteUrl =
        typeof window !== "undefined"
          ? window.location.origin.replace("/studio", "")
          : "";

      const res = await fetch(`${siteUrl}/api/ai/headlines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline, excerpt, pillar, countries }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json() as { headlines: string[] };
      setHeadlines(data.headlines);
    } catch {
      toast.push({ status: "error", title: "Failed to generate headlines" });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function applyHeadline(h: string) {
    // Use Sanity's patch API to set the field value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props as any).patch?.([{ type: "set", path: "satiricalHeadline", value: h }]);
    toast.push({ status: "success", title: "Satirical headline applied — save to confirm" });
    setOpen(false);
    props.onComplete();
  }

  return {
    label: loading ? "Generating…" : "✦ Generate Headlines",
    title: "Generate satirical subheadlines using Claude AI",
    onHandle: generate,
    dialog: open
      ? {
          type: "popover" as const,
          onClose: () => setOpen(false),
          content: (
            <div style={{ padding: "16px", minWidth: "340px", maxWidth: "480px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "12px", color: "#666" }}>
                ✦ Satirical Subheadlines
              </p>
              {loading && (
                <p style={{ fontSize: "13px", color: "#888" }}>Claude is thinking…</p>
              )}
              {headlines.map((h, i) => (
                <button
                  key={i}
                  onClick={() => applyHeadline(h)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    marginBottom: "6px",
                    background: "#f5f0e8",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontStyle: "italic",
                    lineHeight: "1.4",
                    color: "#0f1923",
                  }}
                >
                  {h}
                </button>
              ))}
            </div>
          ),
        }
      : undefined,
  };
}
