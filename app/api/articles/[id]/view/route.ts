import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: true });

  try {
    // Upsert into article_views table (increment counter)
    const res = await fetch(
      `${supabaseUrl}/rest/v1/rpc/increment_article_views`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ article_id: id }),
      }
    );
    if (!res.ok) {
      // Graceful fallback — don't crash the client
      console.error("article view increment failed", res.status);
    }
  } catch (e) {
    console.error("article view error", e);
  }

  return NextResponse.json({ ok: true });
}
