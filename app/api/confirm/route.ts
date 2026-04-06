import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/subscribe?error=missing_token`);
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("subscribers")
    .update({ confirmed: true, confirmation_token: null })
    .eq("confirmation_token", token)
    .select("email")
    .single();

  if (error || !data) {
    return NextResponse.redirect(`${siteUrl}/subscribe?error=invalid_token`);
  }

  return NextResponse.redirect(`${siteUrl}/welcome?email=${encodeURIComponent(data.email)}`);
}
