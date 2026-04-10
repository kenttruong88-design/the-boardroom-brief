import { NextResponse } from "next/server";

interface HealthCheck {
  status: "ok" | "degraded";
  timestamp: string;
  services: Record<string, "ok" | "missing" | "error">;
  version: string;
}

export async function GET() {
  const checks: HealthCheck["services"] = {};

  // Check env vars (not values — just presence)
  checks.sanity = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ? "ok" : "missing";
  checks.supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? "ok" : "missing";
  checks.resend = process.env.RESEND_API_KEY ? "ok" : "missing";
  checks.anthropic = process.env.ANTHROPIC_API_KEY ? "ok" : "missing";
  checks.polygon = process.env.POLYGON_API_KEY ? "ok" : "missing";
  checks.stripe = process.env.STRIPE_SECRET_KEY ? "ok" : "missing";

  const degraded = Object.values(checks).some((v) => v !== "ok");

  const body: HealthCheck = {
    status: degraded ? "degraded" : "ok",
    timestamp: new Date().toISOString(),
    services: checks,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  };

  return NextResponse.json(body, { status: degraded ? 207 : 200 });
}
