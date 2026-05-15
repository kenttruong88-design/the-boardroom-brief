import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscribers")
    .select("id, email, first_name, segments, economies, frequency")
    .eq("unsubscribe_token", token)
    .neq("status", "unsubscribed")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });
  }

  return NextResponse.json({ subscriber: data });
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      token: string;
      firstName?: string;
      segments?: string[];
      economies?: string[];
      frequency?: string;
    };

    const { token, firstName, segments, economies, frequency } = body;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("subscribers")
      .update({
        first_name: firstName?.trim() || null,
        segments: segments && segments.length > 0 ? segments : ["{all}"],
        economies: economies ?? [],
        frequency: frequency ?? "daily",
      })
      .eq("unsubscribe_token", token)
      .neq("status", "unsubscribed");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
