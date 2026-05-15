"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Send, Download, ChevronDown, ChevronRight, RefreshCw,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
  totalConfirmed: number;
  newThisWeek: number;
  todaySendStatus: string;
  lastSendOpenRate: number | null;
  lastSendClickRate: number | null;
  lastSendDate: string | null;
  avgOpenRate30d: number | null;
  growth: { date: string; count: number }[];
}

interface Send {
  id: string;
  send_date: string;
  subject: string | null;
  sent_count: number;
  open_count: number;
  click_count: number;
  unsubscribe_count: number;
  failed_count: number;
  articles_included: string[] | null;
  status: string;
  duration_ms: number | null;
}

interface SendDetail {
  opensByHour: { hour: number; opens: number }[];
  articlesIncluded: string[];
}

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  status: string;
  confirmed_at: string | null;
  created_at: string;
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  source: string | null;
}

interface SubscriberCounts {
  pending: number;
  confirmed: number;
  unsubscribed: number;
  bounced: number;
  total: number;
}

type StatusFilter = "all" | "confirmed" | "pending" | "unsubscribed" | "bounced";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

function fmtPct(n: number | null) {
  return n === null ? "—" : `${n}%`;
}

function fmtHour(h: number) {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

const STATUS_COLORS: Record<string, string> = {
  sent:       "#15803d",
  sending:    "#1d4ed8",
  pending:    "#b45309",
  failed:     "#b91c1c",
  not_sent:   "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  sent:     "Sent",
  sending:  "Sending…",
  pending:  "Pending",
  failed:   "Failed",
  not_sent: "Not yet",
};

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  sub,
  color = "var(--navy)",
}: {
  value: string | number;
  label: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-3xl font-serif font-bold mb-1" style={{ color }}>{value}</div>
      <div className="text-xs font-sans font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--ink-m)" }}>
        {label}
      </div>
      {sub && <div className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>{sub}</div>}
    </div>
  );
}

// ── Growth chart ──────────────────────────────────────────────────────────────

function GrowthChart({ raw }: { raw: { date: string; count: number }[] }) {
  // Compute cumulative totals
  let cumulative = 0;
  const data = raw.map(({ date, count }) => {
    cumulative += count;
    return { date, total: cumulative };
  });

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm font-sans"
        style={{ color: "var(--ink-m)", border: "1px solid var(--border)", background: "var(--surface)" }}>
        No growth data for the last 90 days.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fontFamily: "var(--font-jetbrains)", fill: "var(--ink-m)" }}
          tickFormatter={(v: string) => {
            const d = new Date(v + "T00:00:00Z");
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
          }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 10, fontFamily: "var(--font-jetbrains)", fill: "var(--ink-m)" }} />
        <Tooltip
          contentStyle={{ fontSize: 12, fontFamily: "var(--font-dm-sans)", border: "1px solid var(--border)", background: "var(--cream)" }}
          labelFormatter={(v) => fmtDate(String(v))}
          formatter={(v) => [v, "Subscribers"]}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke="#0f1923"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#c8391a" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Hours chart ───────────────────────────────────────────────────────────────

function HoursChart({ data }: { data: { hour: number; opens: number }[] }) {
  const hasData = data.some((d) => d.opens > 0);
  if (!hasData) {
    return (
      <div className="text-xs font-sans py-4 text-center" style={{ color: "var(--ink-m)" }}>
        No open tracking data yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 9, fontFamily: "var(--font-jetbrains)", fill: "var(--ink-m)" }}
          tickFormatter={fmtHour}
          interval={3}
        />
        <YAxis tick={{ fontSize: 9, fontFamily: "var(--font-jetbrains)", fill: "var(--ink-m)" }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 11, fontFamily: "var(--font-dm-sans)", border: "1px solid var(--border)", background: "var(--cream)" }}
          labelFormatter={(h) => `${fmtHour(Number(h))} UTC`}
          formatter={(v) => [v, "Opens"]}
        />
        <Bar dataKey="opens" fill="#0f1923" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Send row ──────────────────────────────────────────────────────────────────

function SendRow({ send }: { send: Send }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<SendDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && !detail) {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/newsletter/sends/${send.id}`);
        if (res.ok) setDetail(await res.json() as SendDetail);
      } finally {
        setDetailLoading(false);
      }
    }
  }

  const openRate = send.sent_count > 0
    ? `${((send.open_count / send.sent_count) * 100).toFixed(1)}%`
    : "—";

  return (
    <>
      <tr
        onClick={toggle}
        className="cursor-pointer transition-colors"
        style={{ borderBottom: "1px solid var(--border)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,25,35,0.03)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
      >
        <td className="py-3 px-3">
          <div className="flex items-center gap-1.5">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--ink-m)" }} />
              : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--ink-m)" }} />}
            <span className="text-xs font-mono" style={{ color: "var(--ink-m)" }}>
              {fmtDate(send.send_date)}
            </span>
          </div>
        </td>
        <td className="py-3 px-3 max-w-xs">
          <span className="text-xs font-sans" style={{ color: "var(--ink)" }}>
            {send.subject
              ? send.subject.replace(" | The Boardroom Brief", "")
              : <span style={{ color: "var(--ink-m)" }}>—</span>}
          </span>
        </td>
        <td className="py-3 px-3 text-xs font-mono text-right" style={{ color: "var(--ink)" }}>
          {send.sent_count.toLocaleString()}
        </td>
        <td className="py-3 px-3 text-xs font-mono text-right" style={{ color: "var(--ink)" }}>
          {send.open_count.toLocaleString()}
        </td>
        <td className="py-3 px-3 text-xs font-mono text-right" style={{ color: "var(--ink)" }}>
          {send.click_count.toLocaleString()}
        </td>
        <td className="py-3 px-3 text-xs font-mono text-right" style={{ color: "var(--ink-m)" }}>
          {send.unsubscribe_count.toLocaleString()}
        </td>
        <td className="py-3 px-3 text-right">
          <span
            className="text-xs font-mono font-bold"
            style={{ color: send.open_count > 0 ? "#15803d" : "var(--ink-m)" }}
          >
            {openRate}
          </span>
        </td>
      </tr>

      {expanded && (
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          <td colSpan={7} className="px-6 py-5" style={{ background: "rgba(15,25,35,0.02)" }}>
            {detailLoading ? (
              <div className="flex items-center gap-2 text-xs font-sans" style={{ color: "var(--ink-m)" }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </div>
            ) : detail ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Articles */}
                <div>
                  <div className="text-xs font-sans font-semibold uppercase tracking-widest mb-2"
                    style={{ color: "var(--ink-m)" }}>
                    Articles included ({detail.articlesIncluded.length})
                  </div>
                  {detail.articlesIncluded.length === 0 ? (
                    <p className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>No articles recorded.</p>
                  ) : (
                    <ul className="space-y-1">
                      {detail.articlesIncluded.map((url, i) => (
                        <li key={i}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-sans break-all"
                            style={{ color: "var(--navy)", textDecoration: "underline" }}
                          >
                            {url.split("/").slice(-2).join("/")}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Hourly opens */}
                <div>
                  <div className="text-xs font-sans font-semibold uppercase tracking-widest mb-2"
                    style={{ color: "var(--ink-m)" }}>
                    Opens by hour (UTC)
                  </div>
                  <HoursChart data={detail.opensByHour} />
                </div>
              </div>
            ) : null}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewsletterDashboard() {
  const router = useRouter();

  const [authed, setAuthed]         = useState<boolean | null>(null);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [sends, setSends]           = useState<Send[]>([]);
  const [sendsTotal, setSendsTotal] = useState(0);
  const [sendsLoading, setSendsLoading] = useState(false);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subTotal, setSubTotal]     = useState(0);
  const [subCounts, setSubCounts]   = useState<SubscriberCounts | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subPage, setSubPage]       = useState(1);
  const [subFilter, setSubFilter]   = useState<StatusFilter>("all");
  const [sendNowLoading, setSendNowLoading] = useState(false);
  const [sendNowResult, setSendNowResult]   = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else setAuthed(true);
    });
  }, [router]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/newsletter/stats");
      if (res.ok) setStats(await res.json() as Stats);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchSends = useCallback(async () => {
    setSendsLoading(true);
    try {
      const res = await fetch("/api/newsletter/sends?limit=30");
      if (res.ok) {
        const d = await res.json() as { sends: Send[]; total: number };
        setSends(d.sends);
        setSendsTotal(d.total);
      }
    } finally {
      setSendsLoading(false);
    }
  }, []);

  const fetchSubscribers = useCallback(async (filter: StatusFilter, page: number) => {
    setSubLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), ...(filter !== "all" ? { status: filter } : {}) });
      const res = await fetch(`/api/newsletter/subscribers?${params}`);
      if (res.ok) {
        const d = await res.json() as {
          subscribers: Subscriber[];
          total: number;
          counts: SubscriberCounts;
        };
        setSubscribers(d.subscribers);
        setSubTotal(d.total);
        setSubCounts(d.counts);
      }
    } finally {
      setSubLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      fetchStats();
      fetchSends();
      fetchSubscribers("all", 1);
    }
  }, [authed, fetchStats, fetchSends, fetchSubscribers]);

  function handleFilterChange(f: StatusFilter) {
    setSubFilter(f);
    setSubPage(1);
    fetchSubscribers(f, 1);
  }

  function handlePageChange(p: number) {
    setSubPage(p);
    fetchSubscribers(subFilter, p);
  }

  async function handleSendNow() {
    setSendNowLoading(true);
    setSendNowResult("");
    try {
      const res = await fetch("/api/newsletter/trigger", { method: "POST" });
      const d = await res.json() as { status?: string; error?: string };
      if (res.ok) {
        setSendNowResult("Send triggered. Refresh in a few minutes to see the result.");
        setTimeout(fetchStats, 3000);
      } else {
        setSendNowResult(d.error ?? "Failed to trigger send.");
      }
    } finally {
      setSendNowLoading(false);
    }
  }

  if (authed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--navy)" }} />
      </div>
    );
  }

  const totalPages = Math.ceil(subTotal / 50);
  const sendStatusColor = STATUS_COLORS[stats?.todaySendStatus ?? "not_sent"] ?? "#6b7280";
  const sendStatusLabel = STATUS_LABELS[stats?.todaySendStatus ?? "not_sent"] ?? "Unknown";

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-8 pb-6"
          style={{ borderBottom: "2px solid var(--navy)" }}>
          <div>
            <p className="eyebrow mb-1">Dashboard</p>
            <h1 className="text-3xl font-serif font-bold" style={{ color: "var(--navy)" }}>
              Newsletter
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <button
              onClick={handleSendNow}
              disabled={sendNowLoading}
              className="flex items-center gap-2 text-sm font-sans font-semibold px-4 py-2.5 transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--red)", color: "#fff", borderRadius: "2px" }}
            >
              {sendNowLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              {sendNowLoading ? "Triggering…" : "Send now"}
            </button>
            {sendNowResult && (
              <p className="text-xs font-sans max-w-xs text-right"
                style={{ color: sendNowResult.includes("Failed") ? "var(--red)" : "#15803d" }}>
                {sendNowResult}
              </p>
            )}
          </div>
        </div>

        {/* ── Stats row ── */}
        <section className="mb-10">
          {statsLoading && !stats ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard
                value={stats.totalConfirmed.toLocaleString()}
                label="Subscribers"
                sub="confirmed"
              />
              <StatCard
                value={`+${stats.newThisWeek}`}
                label="New this week"
                color={stats.newThisWeek > 0 ? "#15803d" : "var(--navy)"}
              />
              <StatCard
                value={sendStatusLabel}
                label="Today's send"
                color={sendStatusColor}
                sub={stats.lastSendDate ? `Last: ${fmtDate(stats.lastSendDate)}` : undefined}
              />
              <StatCard
                value={fmtPct(stats.lastSendOpenRate)}
                label="Last open rate"
                color={stats.lastSendOpenRate !== null ? (stats.lastSendOpenRate >= 20 ? "#15803d" : "#b45309") : "var(--ink-m)"}
              />
              <StatCard
                value={fmtPct(stats.lastSendClickRate)}
                label="Last click rate"
                color={stats.lastSendClickRate !== null ? (stats.lastSendClickRate >= 3 ? "#15803d" : "#b45309") : "var(--ink-m)"}
              />
              <StatCard
                value={fmtPct(stats.avgOpenRate30d)}
                label="Avg open rate"
                sub="30 days"
                color={stats.avgOpenRate30d !== null ? (stats.avgOpenRate30d >= 20 ? "#15803d" : "#b45309") : "var(--ink-m)"}
              />
            </div>
          ) : null}
        </section>

        {/* ── Send history table ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>
              Send history
              {sendsTotal > 0 && (
                <span className="ml-2 text-sm font-sans font-normal" style={{ color: "var(--ink-m)" }}>
                  {sendsTotal} total
                </span>
              )}
            </h2>
            <button
              onClick={fetchSends}
              disabled={sendsLoading}
              className="flex items-center gap-1.5 text-xs font-sans px-3 py-1.5"
              style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)" }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sendsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", overflowX: "auto" }}>
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  {["Date", "Subject", "Sent", "Opens", "Clicks", "Unsubs", "Open rate"].map((h, i) => (
                    <th key={h}
                      className={`py-2.5 px-3 text-xs font-sans font-semibold uppercase tracking-wider whitespace-nowrap ${i >= 2 ? "text-right" : "text-left"}`}
                      style={{ color: "var(--ink-m)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sendsLoading && sends.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm font-sans" style={{ color: "var(--ink-m)" }}>
                      Loading…
                    </td>
                  </tr>
                ) : sends.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm font-sans" style={{ color: "var(--ink-m)" }}>
                      No sends yet.
                    </td>
                  </tr>
                ) : (
                  sends.map((s) => <SendRow key={s.id} send={s} />)
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Subscriber growth chart ── */}
        <section className="mb-10">
          <h2 className="text-lg font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>
            Subscriber growth — last 90 days
          </h2>
          <div className="p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {stats ? (
              <GrowthChart raw={stats.growth} />
            ) : (
              <div className="h-48 animate-pulse" style={{ background: "var(--border)" }} />
            )}
          </div>
        </section>

        {/* ── Subscriber list ── */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>
                Subscribers
              </h2>
              {subCounts && (
                <p className="text-xs font-sans mt-0.5" style={{ color: "var(--ink-m)" }}>
                  {subCounts.confirmed.toLocaleString()} confirmed ·{" "}
                  {subCounts.pending.toLocaleString()} pending ·{" "}
                  {subCounts.unsubscribed.toLocaleString()} unsubscribed ·{" "}
                  {subCounts.bounced.toLocaleString()} bounced
                </p>
              )}
            </div>
            <a
              href="/api/newsletter/subscribers/export"
              className="flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-2"
              style={{
                border: "1px solid var(--border)", borderRadius: 2,
                color: "var(--ink)", textDecoration: "none", background: "var(--surface)",
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5 flex-wrap mb-4">
            {(["all", "confirmed", "pending", "unsubscribed", "bounced"] as StatusFilter[]).map((f) => {
              const active = subFilter === f;
              const count = subCounts
                ? f === "all" ? subCounts.total : subCounts[f]
                : null;
              return (
                <button
                  key={f}
                  onClick={() => handleFilterChange(f)}
                  className="text-xs font-sans px-3 py-1.5 capitalize"
                  style={{
                    background: active ? "var(--navy)" : "transparent",
                    color:      active ? "var(--cream)" : "var(--ink-m)",
                    border:     `1px solid ${active ? "var(--navy)" : "var(--border)"}`,
                    borderRadius: 2,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {f}{count !== null ? ` (${count.toLocaleString()})` : ""}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", overflowX: "auto" }}>
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  {["Email", "Name", "Status", "Subscribed", "Opens", "Clicks", "Source"].map((h) => (
                    <th key={h}
                      className="py-2.5 px-3 text-left text-xs font-sans font-semibold uppercase tracking-wider"
                      style={{ color: "var(--ink-m)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subLoading && subscribers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm font-sans" style={{ color: "var(--ink-m)" }}>
                      Loading…
                    </td>
                  </tr>
                ) : subscribers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm font-sans" style={{ color: "var(--ink-m)" }}>
                      No subscribers found.
                    </td>
                  </tr>
                ) : (
                  subscribers.map((sub) => {
                    const statusColor =
                      sub.status === "confirmed" ? "#15803d"
                      : sub.status === "pending"  ? "#b45309"
                      : sub.status === "bounced"  ? "#b91c1c"
                      : "#6b7280";
                    return (
                      <tr key={sub.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="py-2.5 px-3 text-xs font-mono" style={{ color: "var(--ink)" }}>
                          {sub.email}
                        </td>
                        <td className="py-2.5 px-3 text-xs font-sans" style={{ color: "var(--ink)" }}>
                          {sub.first_name ?? <span style={{ color: "var(--ink-m)" }}>—</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-xs font-mono capitalize" style={{ color: statusColor }}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-xs font-mono whitespace-nowrap" style={{ color: "var(--ink-m)" }}>
                          {sub.confirmed_at
                            ? fmtDate(sub.confirmed_at)
                            : <span>—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-xs font-mono text-right" style={{ color: "var(--ink-m)" }}>
                          {sub.emails_opened}
                        </td>
                        <td className="py-2.5 px-3 text-xs font-mono text-right" style={{ color: "var(--ink-m)" }}>
                          {sub.emails_clicked}
                        </td>
                        <td className="py-2.5 px-3 text-xs font-sans" style={{ color: "var(--ink-m)" }}>
                          {sub.source ?? "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>
                Page {subPage} of {totalPages} · {subTotal.toLocaleString()} total
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handlePageChange(subPage - 1)}
                  disabled={subPage <= 1 || subLoading}
                  className="px-3 py-1.5 text-xs font-sans disabled:opacity-40"
                  style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)" }}
                >
                  Prev
                </button>
                <button
                  onClick={() => handlePageChange(subPage + 1)}
                  disabled={subPage >= totalPages || subLoading}
                  className="px-3 py-1.5 text-xs font-sans disabled:opacity-40"
                  style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)" }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
