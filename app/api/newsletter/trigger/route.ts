import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/editorial/_helpers";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;

  // Fire-and-forget — the send route handles idempotency internally
  fetch(`${base}/api/newsletter/send?force=true`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  }).catch((err) => console.error("[newsletter/trigger]", err));

  return NextResponse.json({ status: "sending" });
}
