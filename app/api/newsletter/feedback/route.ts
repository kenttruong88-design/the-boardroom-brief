import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { message, email } = await req.json() as {
      message?: string;
      email?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    await supabase.from("subscriber_feedback").insert({
      message: message.trim(),
      email: email?.trim() || null,
      source: "unsubscribed",
    });

    return NextResponse.json({ success: true });
  } catch {
    // Non-critical — never fail the unsubscribe flow because of feedback
    return NextResponse.json({ success: true });
  }
}
