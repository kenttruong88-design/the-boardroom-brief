import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");

  if (secret !== process.env.SANITY_WEBHOOK_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { _type, slug } = body;

    // Revalidate based on document type
    if (_type === "article") {
      revalidatePath("/");
      if (slug?.current) {
        // Revalidate all section pages — we don't know the exact pillar from the webhook body
        revalidatePath("/[section]", "page");
        revalidatePath("/[section]/[slug]", "page");
      }
    } else if (_type === "pillar") {
      revalidatePath("/");
    } else {
      // Fallback: revalidate everything
      revalidatePath("/", "layout");
    }

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch {
    return NextResponse.json({ message: "Error revalidating" }, { status: 500 });
  }
}
