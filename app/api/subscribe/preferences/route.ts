import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase";

export async function POST(req: Request) {
  try {
    const { email, segments } = await req.json() as { email: string; segments: string[] };

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    await supabase
      .from("subscribers")
      .update({ segments })
      .eq("email", email);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
