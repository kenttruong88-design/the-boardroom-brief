import { writeClient } from "@/app/lib/sanity";
import type { ArticleDraft } from "@/app/lib/agents/types";

export interface SanityPublishResult {
  sanityDocId: string;
  slug: string;
  publishedUrl: string;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

export async function createSanityArticle(
  draft: ArticleDraft,
  status: "published" | "draft" = "published"
): Promise<SanityPublishResult> {
  if (!writeClient) {
    throw new Error("Sanity write client not configured — check SANITY_API_TOKEN");
  }

  const slug = slugify(draft.headline);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealignmenttimes.com";

  const doc = {
    _type: "article",
    title: draft.headline,
    slug: { _type: "slug", current: slug },
    satiricalHeadline: draft.satiricalHeadline,
    excerpt: draft.body.split("\n\n")[0].slice(0, 300),
    body: draft.body.split("\n\n").map((para, i) => ({
      _type: "block",
      _key: `p${i}`,
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: `s${i}`, text: para, marks: [] }],
    })),
    pillar: { _type: "reference", _ref: draft.pillar },
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    tags: draft.tags,
    tone: draft.tone,
    publishedAt: status === "published" ? new Date().toISOString() : null,
    aiGenerated: true,
    agentName: draft.agentName,
    featured: false,
    status,
  };

  const created = await writeClient.create(doc);

  // Trigger ISR revalidation — non-fatal if it fails
  await fetch(
    `${siteUrl}/api/revalidate?secret=${process.env.REVALIDATE_SECRET}&path=/${draft.pillar}`,
    { method: "POST" }
  ).catch(() => {});

  return {
    sanityDocId: created._id,
    slug,
    publishedUrl: `${siteUrl}/${draft.pillar}/${slug}`,
  };
}
