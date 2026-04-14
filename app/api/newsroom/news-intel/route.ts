import { NextResponse } from "next/server";
import { runNewsIntelAgent } from "@/app/lib/agents/news-intel/orchestrator";

export const maxDuration = 300; // 5 minutes — this is a long-running job

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}

async function run() {
  try {
    const result = await runNewsIntelAgent();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[newsroom/news-intel]", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
