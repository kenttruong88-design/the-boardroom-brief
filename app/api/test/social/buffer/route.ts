import { NextResponse } from "next/server";
import { getBufferProfiles, getBufferUser } from "@/app/lib/social/buffer-client";

const EXPECTED_PLATFORMS = ["linkedin", "twitter", "instagram"] as const;

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test routes are disabled in production" }, { status: 403 });
  }

  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({
      connected: false,
      error: "Invalid or missing BUFFER_ACCESS_TOKEN",
    });
  }

  try {
    const [profiles, user] = await Promise.all([
      getBufferProfiles(),
      getBufferUser().catch(() => ({ plan: "unknown" })),
    ]);

    const profilesByPlatform = Object.fromEntries(
      profiles.map((p) => [p.service, p])
    );

    const connectedProfiles = EXPECTED_PLATFORMS.map((platform) => {
      const p = profilesByPlatform[platform];
      return {
        platform,
        profileId:  p?.id ?? null,
        username:   p?.serviceUsername ?? null,
        connected:  !!p,
      };
    });

    const missingPlatforms = connectedProfiles
      .filter((p) => !p.connected)
      .map((p) => p.platform);

    return NextResponse.json({
      connected: true,
      profiles:  connectedProfiles,
      missingPlatforms,
      bufferPlan: user.plan,
    });
  } catch (err) {
    return NextResponse.json({
      connected: false,
      error:     err instanceof Error ? err.message : "Invalid or missing BUFFER_ACCESS_TOKEN",
    });
  }
}
