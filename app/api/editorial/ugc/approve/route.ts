import { NextResponse } from "next/server";
import { requireAuth } from "../../_helpers";
import { approveUgcVideo, rejectUgcVideo } from "@/app/lib/social/ugc-video-generator";

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as { queueId: string; action: "approve" | "reject" };
  if (!body.queueId) {
    return NextResponse.json({ error: "Missing queueId" }, { status: 400 });
  }

  try {
    const row = body.action === "reject"
      ? await rejectUgcVideo(body.queueId)
      : await approveUgcVideo(body.queueId);
    return NextResponse.json({ success: true, video: row });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
