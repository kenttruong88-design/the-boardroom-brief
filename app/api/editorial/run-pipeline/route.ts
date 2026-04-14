import { NextResponse } from "next/server";
import { requireAuth } from "../_helpers";

export const maxDuration = 300;

/** Session-authenticated proxy so the dashboard can trigger the pipeline
 *  without exposing CRON_SECRET to the client. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Derive base URL for the internal call
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;

  const res = await fetch(`${base}/api/newsroom/run`, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
