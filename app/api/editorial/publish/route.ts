import { NextResponse } from "next/server";
import { writeClient } from "@/app/lib/sanity";
import type { ArticleDraft } from "@/app/lib/agents/types";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

export async function POST(req: Request) {
  if (!writeClient) {
    return NextResponse.json({ error: "Sanity write client not configured" }, { status: 500 });
  }

  const draft = await req.json() as ArticleDraft;

  const pillarRef = draft.pillar; // use slug directly; assumes pillar docs exist

  const doc = {
    _type: "article",
    title: draft.headline,
    slug: { _type: "slug", current: slugify(draft.headline) },
    satiricalHeadline: draft.satiricalHeadline,
    excerpt: draft.body.split("\n\n")[0].slice(0, 300),
    body: draft.body.split("\n\n").map((para, i) => ({
      _type: "block",
      _key: `p${i}`,
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: `s${i}`, text: para, marks: [] }],
    })),
    pillar: { _type: "reference", _ref: pillarRef },
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    tags: draft.tags,
    tone: draft.tone,
    publishedAt: new Date().toISOString(),
    aiGenerated: true,
    agentName: draft.agentName,
    featured: false,
  };

  try {
    const created = await writeClient.create(doc);

    // Trigger ISR revalidation
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    await fetch(`${siteUrl}/api/revalidate?secret=${process.env.REVALIDATE_SECRET}&path=/${draft.pillar}`, {
      method: "POST",
    }).catch(() => {}); // non-fatal

    return NextResponse.json({ published: true, id: created._id, slug: doc.slug.current });
  } catch (err) {
    console.error("[publish]", err);
    return NextResponse.json({ error: "Sanity write failed" }, { status: 500 });
  }
}
