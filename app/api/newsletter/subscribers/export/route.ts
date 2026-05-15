import { createAdminClient } from "@/app/lib/supabase-server";

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("subscribers")
    .select("email, first_name, confirmed_at, emails_sent, emails_opened, emails_clicked")
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = (data ?? []) as {
    email: string;
    first_name: string | null;
    confirmed_at: string | null;
    emails_sent: number;
    emails_opened: number;
    emails_clicked: number;
  }[];

  const csv = [
    "email,first_name,confirmed_at,emails_sent,emails_opened,emails_clicked",
    ...rows.map((r) =>
      [
        `"${r.email}"`,
        `"${(r.first_name ?? "").replace(/"/g, '""')}"`,
        `"${r.confirmed_at ?? ""}"`,
        r.emails_sent,
        r.emails_opened,
        r.emails_clicked,
      ].join(",")
    ),
  ].join("\n");

  const date = new Date().toISOString().split("T")[0];

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="subscribers-${date}.csv"`,
    },
  });
}
