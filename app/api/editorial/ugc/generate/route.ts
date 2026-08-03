import { NextResponse } from "next/server";
import { requireAuth } from "../../_helpers";
import { draftUgcVideo } from "@/app/lib/social/ugc-video-generator";

export const maxDuration = 60;

// Out of Office only, Suki only. Pass the raw content/out-of-office/*.md
// source — headline and both countries' Do's & Don'ts are parsed from it.
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as {
    slug:       string;
    articleUrl: string;
    markdown:   string;
  };

  if (!body.slug)       return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  if (!body.articleUrl) return NextResponse.json({ error: "Missing articleUrl" }, { status: 400 });
  if (!body.markdown)   return NextResponse.json({ error: "Missing markdown" }, { status: 400 });

  try {
    const row = await draftUgcVideo(body);
    return NextResponse.json({ success: true, video: row });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
