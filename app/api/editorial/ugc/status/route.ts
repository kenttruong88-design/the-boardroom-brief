import { NextResponse } from "next/server";
import { requireAuth } from "../../_helpers";
import { finalizeUgcVideo } from "@/app/lib/social/ugc-video-generator";

export const maxDuration = 60;

// Poll this once the video is "generating_video" — it checks Hedra once and,
// if complete, re-hosts the video on Cloudinary. Call again later if the
// returned status is still "generating_video".
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const queueId = new URL(req.url).searchParams.get("queueId");
  if (!queueId) {
    return NextResponse.json({ error: "Missing queueId" }, { status: 400 });
  }

  try {
    const row = await finalizeUgcVideo(queueId);
    return NextResponse.json({ success: true, video: row });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
