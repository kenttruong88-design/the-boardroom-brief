import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import type { DailyDigest } from "@/app/lib/agents/types";

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

// GET — return today's pending digest
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("daily_digest")
    .select("*")
    .eq("date", todayDate())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "No digest found for today" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// POST — approve, reject, or edit an article
export async function POST(req: Request) {
  const body = await req.json() as {
    action: "approve" | "reject" | "edit";
    articleIndex: number;
  };

  const { action, articleIndex } = body;
  if (!action || articleIndex === undefined) {
    return NextResponse.json({ error: "action and articleIndex required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("daily_digest")
    .select("digest_json, articles_approved, articles_rejected")
    .eq("date", todayDate())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "No digest for today" }, { status: 404 });
  }

  const digest = data.digest_json as DailyDigest;
  const article = digest.articles[articleIndex];
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (action === "approve") {
    await supabase
      .from("daily_digest")
      .update({ articles_approved: (data.articles_approved ?? 0) + 1 })
      .eq("date", todayDate());
    return NextResponse.json({ message: "approved", article });
  }

  if (action === "reject") {
    await supabase
      .from("daily_digest")
      .update({ articles_rejected: (data.articles_rejected ?? 0) + 1 })
      .eq("date", todayDate());
    return NextResponse.json({ message: "rejected" });
  }

  // edit — return the draft for the client to open in Sanity Studio
  return NextResponse.json({ message: "edit", article });
}
