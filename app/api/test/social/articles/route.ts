import { NextResponse } from "next/server";
import { getLatestArticles } from "@/app/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_TEST_ROUTES) {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const articles = await getLatestArticles(20);

  return NextResponse.json(
    articles.map((a) => ({
      id: a._id,
      title: a.title,
      pillar: a.pillar?.name ?? "General",
      publishedAt: a.publishedAt,
    }))
  );
}
