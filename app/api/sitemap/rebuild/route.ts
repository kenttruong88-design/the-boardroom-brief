import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

function isAuthorized(req: Request): boolean {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") ?? req.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return rebuild();
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return rebuild();
}

function rebuild() {
  // Revalidate the sitemap and key pages
  revalidatePath("/sitemap.xml");
  revalidatePath("/", "layout");
  return NextResponse.json({ rebuilt: true, at: new Date().toISOString() });
}
