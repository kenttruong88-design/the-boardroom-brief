import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";
import { createClient } from "@sanity/client";

type CheckStatus = "ok" | "degraded" | "down";

interface CheckResult {
  status: CheckStatus;
  latencyMs?: number;
  detail?: string;
}

async function checkSupabase(): Promise<CheckResult> {
  const t = Date.now();
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("subscribers").select("id").limit(1).single();
    // "no rows" is fine — that's still a live DB
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    return { status: "ok", latencyMs: Date.now() - t };
  } catch (err) {
    return { status: "down", latencyMs: Date.now() - t, detail: (err as Error).message };
  }
}

async function checkSanity(): Promise<CheckResult> {
  const t = Date.now();
  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
    const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
    if (!projectId) return { status: "degraded", detail: "NEXT_PUBLIC_SANITY_PROJECT_ID not set" };

    const client = createClient({ projectId, dataset, apiVersion: "2024-01-01", useCdn: false });
    await client.fetch(`*[_type == "pillar"][0]{ _id }`);
    return { status: "ok", latencyMs: Date.now() - t };
  } catch (err) {
    return { status: "down", latencyMs: Date.now() - t, detail: (err as Error).message };
  }
}

async function checkMarketData(): Promise<CheckResult & { lastUpdated?: string; ageMinutes?: number }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("market_cache")
      .select("pulled_at")
      .order("pulled_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { status: "degraded", detail: error.message };
    if (!data) return { status: "degraded", detail: "No market data in cache" };

    const ageMinutes = Math.floor((Date.now() - new Date(data.pulled_at).getTime()) / 60_000);
    const isWeekday  = [1, 2, 3, 4, 5].includes(new Date().getUTCDay());
    const hour       = new Date().getUTCHours();
    const inMarketHours = isWeekday && hour >= 13 && hour <= 21;

    const status: CheckStatus = inMarketHours && ageMinutes > 60 ? "degraded" : "ok";
    return { status, lastUpdated: data.pulled_at, ageMinutes };
  } catch (err) {
    return { status: "degraded", detail: (err as Error).message };
  }
}

async function checkNewsletter(): Promise<CheckResult & { lastSent?: string; hoursAgo?: number }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("newsletter_sends")
      .select("send_date, status, completed_at")
      .eq("status", "sent")
      .order("send_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { status: "degraded", detail: error.message };
    if (!data) return { status: "ok", detail: "No sends yet" };

    const hoursAgo = data.completed_at
      ? Math.floor((Date.now() - new Date(data.completed_at).getTime()) / 3_600_000)
      : null;

    return { status: "ok", lastSent: data.send_date, hoursAgo: hoursAgo ?? undefined };
  } catch (err) {
    return { status: "degraded", detail: (err as Error).message };
  }
}

async function checkNewsroom(): Promise<CheckResult & { lastRun?: string; hoursAgo?: number }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("newsroom_runs")
      .select("date, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { status: "degraded", detail: error.message };
    if (!data) return { status: "ok", detail: "No runs yet" };

    const hoursAgo = Math.floor(
      (Date.now() - new Date(data.created_at).getTime()) / 3_600_000
    );

    return { status: "ok", lastRun: data.date, hoursAgo };
  } catch (err) {
    return { status: "degraded", detail: (err as Error).message };
  }
}

export async function GET() {
  const [supabase, sanity, marketData, newsletter, newsroom] = await Promise.all([
    checkSupabase(),
    checkSanity(),
    checkMarketData(),
    checkNewsletter(),
    checkNewsroom(),
  ]);

  const checks = { supabase, sanity, marketData, newsletter, newsroom };

  const statuses = Object.values(checks).map((c) => c.status);
  const overallStatus: CheckStatus = statuses.includes("down")
    ? "down"
    : statuses.includes("degraded")
    ? "degraded"
    : "ok";

  const body = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    checks,
  };

  return NextResponse.json(body, {
    status: overallStatus === "down" ? 503 : 200,
  });
}
