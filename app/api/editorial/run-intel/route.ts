import { NextResponse } from "next/server";
import { runNewsIntelAgent } from "@/app/lib/agents/news-intel/orchestrator";
import { requireAuth } from "../_helpers";

export const maxDuration = 300;

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await runNewsIntelAgent();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[editorial/run-intel]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
