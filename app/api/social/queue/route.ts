import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";
import { createAdminClient } from "@/app/lib/supabase-server";

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayRange(date: Date): { from: string; to: string } {
  const from = new Date(date);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ── GET /api/social/queue?date=today|7days|YYYY-MM-DD ─────────────────────────

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date") ?? "today";

  const supabase = createAdminClient();
  let query = supabase.from("social_queue").select("*").order("scheduled_for", { ascending: true });

  if (dateParam === "7days") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    query = query.gte("created_at", weekAgo.toISOString());
  } else {
    const d = dateParam === "today" ? new Date() : new Date(dateParam);
    const { from, to } = dayRange(d);
    query = query.gte("scheduled_for", from).lt("scheduled_for", to);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: data ?? [] });
}

// ── POST /api/social/queue — manual composer ──────────────────────────────────

interface CreateBody {
  article_id: string;
  article_slug: string;
  article_headline: string;
  platform: string;
  content: string;
  hashtags: string[];
  image_url?: string | null;
  article_url: string;
  scheduled_for: string;
  pillar?: string | null;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as CreateBody;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("social_queue")
    .insert({
      article_id:       body.article_id,
      article_slug:     body.article_slug,
      article_headline: body.article_headline,
      platform:         body.platform,
      content:          body.content,
      hashtags:         body.hashtags,
      image_url:        body.image_url ?? null,
      article_url:      body.article_url,
      scheduled_for:    body.scheduled_for,
      pillar:           body.pillar ?? null,
      status:           "pending_approval",
      generated_by:     "manual",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post: data }, { status: 201 });
}
