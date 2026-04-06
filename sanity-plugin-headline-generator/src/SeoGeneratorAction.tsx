import { useState } from "react";
import { useToast } from "@sanity/ui";
import { type DocumentActionProps } from "sanity";

function blocksToText(blocks: unknown[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b: unknown) => (b as { _type: string })._type === "block")
    .map((b: unknown) => {
      const block = b as { children?: { text?: string }[] };
      return (block.children ?? []).map((c) => c.text ?? "").join("");
    })
    .join(" ")
    .slice(0, 300);
}

interface SeoResult {
  seoTitle: string;
  seoDescription: string;
  tags: string[];
}

export function SeoGeneratorAction(props: DocumentActionProps) {
  const { draft, published } = props;
  const doc = (draft ?? published) as Record<string, unknown> | null;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeoResult | null>(null);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  async function generate() {
    if (!doc) return;
    setLoading(true);
    setOpen(true);
    setResult(null);

    try {
      const headline = (doc.title as string) ?? "";
      const satiricalHeadline = (doc.satiricalHeadline as string) ?? "";
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

      const res = await fetch(`${siteUrl}/api/ai/seo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline, satiricalHeadline, excerpt, pillar, countries }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json() as SeoResult;
      setResult(data);
    } catch {
      toast.push({ status: "error", title: "Failed to generate SEO metadata" });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function applyAll() {
    if (!result) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props as any).patch?.([
      { type: "set", path: "seoTitle",       value: result.seoTitle },
      { type: "set", path: "seoDescription", value: result.seoDescription },
    ]);
    toast.push({ status: "success", title: "SEO fields populated — save to confirm" });
    setOpen(false);
    props.onComplete();
  }

  return {
    label: loading ? "Generating SEO…" : "✦ Generate SEO",
    title: "Auto-generate SEO title, description and tags using Claude AI",
    onHandle: generate,
    dialog: open && result
      ? {
          type: "popover" as const,
          onClose: () => setOpen(false),
          content: (
            <div style={{ padding: "16px", minWidth: "360px", maxWidth: "520px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "12px", color: "#666" }}>
                ✦ SEO Suggestions
              </p>
              <div style={{ marginBottom: "12px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>
                  SEO Title ({result.seoTitle.length}/60)
                </p>
                <p style={{ fontSize: "13px", color: "#0f1923", background: "#f5f0e8", padding: "8px 10px", borderRadius: "3px", margin: 0 }}>
                  {result.seoTitle}
                </p>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>
                  SEO Description ({result.seoDescription.length}/155)
                </p>
                <p style={{ fontSize: "13px", color: "#0f1923", background: "#f5f0e8", padding: "8px 10px", borderRadius: "3px", margin: 0, lineHeight: "1.5" }}>
                  {result.seoDescription}
                </p>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: "6px" }}>
                  Tags
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {result.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: "11px", background: "#0f1923", color: "#f5f0e8", padding: "3px 8px", borderRadius: "2px" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={applyAll}
                style={{ background: "#c8391a", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "3px", cursor: "pointer", fontSize: "13px", fontWeight: 700, width: "100%" }}
              >
                Apply to article →
              </button>
            </div>
          ),
        }
      : open && loading
      ? {
          type: "popover" as const,
          onClose: () => setOpen(false),
          content: (
            <div style={{ padding: "24px", minWidth: "280px" }}>
              <p style={{ fontSize: "13px", color: "#888" }}>Claude is thinking…</p>
            </div>
          ),
        }
      : undefined,
  };
}
