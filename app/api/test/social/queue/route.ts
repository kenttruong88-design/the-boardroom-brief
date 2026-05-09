import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test routes are disabled in production" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // a. Insert test row
  const { data: inserted, error: insertError } = await supabase
    .from("social_queue")
    .insert({
      article_id:       "test",
      article_slug:     "test-slug",
      article_headline: "Test",
      article_url:      "https://example.com",
      platform:         "twitter",
      content:          "Test post — automated pipeline check",
      hashtags:         [],
      scheduled_for:    scheduledFor,
      status:           "pending",
      generated_by:     "test",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({
      success: false,
      step: "insert",
      error: insertError?.message ?? "No row returned",
    });
  }

  const insertedId = inserted.id as string;

  // b. Read back
  const { data: readBack, error: readError } = await supabase
    .from("social_queue")
    .select("id, content, status")
    .eq("id", insertedId)
    .single();

  if (readError || !readBack) {
    return NextResponse.json({
      success: false,
      step: "read",
      insertedId,
      error: readError?.message ?? "Row not found after insert",
    });
  }

  // c. Delete
  const { error: deleteError } = await supabase
    .from("social_queue")
    .delete()
    .eq("id", insertedId);

  if (deleteError) {
    return NextResponse.json({
      success: false,
      step: "delete",
      insertedId,
      error: deleteError.message,
    });
  }

  return NextResponse.json({
    success:     true,
    insertedId,
    readBack:    true,
    deletedOk:   true,
  });
}
