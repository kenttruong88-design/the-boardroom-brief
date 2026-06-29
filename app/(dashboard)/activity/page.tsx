"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw, Loader2, CheckCircle, Clock, AlertCircle,
  Newspaper, Share2, Mail, MessageSquare, Rss, Globe, Briefcase,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityData {
  generatedAt: string;
  articles: {
    publishedToday: number;
    byPillar: { pillar: string; count: number; titles: string[] }[];
    recent: { title: string; pillar: string; publishedAt: string }[];
  };
  blogPosts: {
    outOfOffice:  { publishedToday: number; totalPublished: number; remaining: number };
    globalOffice: { publishedToday: number; totalPublished: number; remaining: number };
  };
  social: {
    totalToday: number;
    byPlatform: { platform: string; total: number; published: number; pending: number }[];
    recent: { headline: string; platform: string; status: string; scheduledFor: string }[];
  };
  newsletter: {
    sentToday: boolean;
    status: string;
    subject: string | null;
    sentCount: number;
    openRate: number | null;
    clickRate: number | null;
    unsubscribeCount: number;
    totalSubscribers: number;
    newToday: number;
  };
  comments: {
    newToday: number;
    approvedToday: number;
    pendingModeration: number;
    likesToday: number;
  };
  newsIntel: {
    ranToday: boolean;
    lastRunAt: string | null;
    storiesFound: number;
    storiesStored: number;
    durationMs: number;
    errors: string[];
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PILLAR_COLORS: Record<string, string> = {
  "markets-floor":  "#1d4ed8",
  "macro-mondays":  "#15803d",
  "c-suite-circus": "#7c3aed",
  "global-office":  "#b45309",
  "water-cooler":   "#be123c",
  "off-the-record": "#c2410c",
  "out-of-office":  "#0f766e",
};

const PILLAR_NAMES: Record<string, string> = {
  "markets-floor":  "Markets Floor",
  "macro-mondays":  "Macro Mondays",
  "c-suite-circus": "C-Suite Circus",
  "global-office":  "Global Office",
  "water-cooler":   "Water Cooler",
  "off-the-record": "Off the Record",
  "out-of-office":  "Out of Office",
};

const PLATFORM_ICONS: Record<string, string> = {
  linkedin:  "in",
  twitter:   "𝕏",
  instagram: "ig",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

function fmtMs(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function pct(n: number | null) {
  return n === null ? "—" : `${n}%`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2" style={{ borderBottom: "2px solid var(--navy)" }}>
      <Icon className="w-4 h-4" style={{ color: "var(--navy)" }} />
      <h2 className="text-sm font-sans font-bold uppercase tracking-widest" style={{ color: "var(--navy)" }}>
        {label}
      </h2>
    </div>
  );
}

function StatChip({
  value, label, color = "var(--navy)", sub,
}: {
  value: string | number; label: string; color?: string; sub?: string;
}) {
  return (
    <div className="p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-2xl font-serif font-bold" style={{ color }}>{value}</div>
      <div className="text-2xs font-sans font-semibold uppercase tracking-widest mt-0.5" style={{ color: "var(--ink-m)" }}>{label}</div>
      {sub && <div className="text-2xs font-sans mt-0.5" style={{ color: "var(--ink-m)" }}>{sub}</div>}
    </div>
  );
}

function StatusDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  const color = ok ? "#15803d" : warn ? "#d97706" : "#9ca3af";
  return <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ background: color }} />;
}

function PillarTag({ slug }: { slug: string }) {
  const color = PILLAR_COLORS[slug] ?? "#6b7280";
  return (
    <span
      className="text-2xs font-mono font-semibold px-1.5 py-0.5 flex-shrink-0"
      style={{ color, border: `1px solid ${color}`, borderRadius: "2px" }}
    >
      {PILLAR_NAMES[slug] ?? slug}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const router = useRouter();
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/activity");
      if (!res.ok) throw new Error("Failed to load activity data");
      setData(await res.json() as ActivityData);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: d }) => {
      if (!d.user) router.replace("/login");
      else load();
    });
  }, [router, load]);

  if (loading) {
    return (
      <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 rounded" style={{ background: "var(--surface)" }} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <div key={i} className="h-20 rounded" style={{ background: "var(--surface)" }} />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
        <div className="max-w-5xl mx-auto px-6 py-12">
          <p className="text-sm font-sans" style={{ color: "var(--red)" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { articles, blogPosts, social, newsletter, comments, newsIntel } = data;

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* ── HEADER ── */}
        <div className="flex items-start justify-between gap-4 mb-8 pb-6" style={{ borderBottom: "2px solid var(--navy)" }}>
          <div>
            <p className="eyebrow mb-1">Dashboard</p>
            <h1 className="text-3xl font-serif font-bold" style={{ color: "var(--navy)" }}>
              Daily Activity
            </h1>
            <p className="text-sm font-sans mt-1" style={{ color: "var(--ink-m)" }}>{today}</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 text-xs font-sans font-semibold px-3 py-2 transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ border: "1px solid var(--border)", color: "var(--ink-m)", borderRadius: "2px" }}
          >
            {refreshing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>

        {/* ── TOP STAT STRIP ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          <StatChip
            value={articles.publishedToday}
            label="Articles today"
            color="var(--navy)"
            sub={`across ${articles.byPillar.length} pillar${articles.byPillar.length !== 1 ? "s" : ""}`}
          />
          <StatChip
            value={social.totalToday}
            label="Social posts"
            color="#7c3aed"
            sub={`${social.byPlatform.reduce((s, p) => s + p.published, 0)} published`}
          />
          <StatChip
            value={newsletter.totalSubscribers.toLocaleString()}
            label="Subscribers"
            color="#15803d"
            sub={newsletter.newToday > 0 ? `+${newsletter.newToday} today` : "no new today"}
          />
          <StatChip
            value={comments.newToday}
            label="New comments"
            color={comments.pendingModeration > 0 ? "#d97706" : "var(--navy)"}
            sub={comments.pendingModeration > 0 ? `${comments.pendingModeration} pending review` : "all moderated"}
          />
        </div>

        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-8">

            {/* Articles */}
            <section>
              <SectionHeader icon={Newspaper} label="Articles Published" />
              {articles.byPillar.length === 0 ? (
                <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>No articles published today yet.</p>
              ) : (
                <div className="space-y-3">
                  {articles.byPillar
                    .sort((a, b) => b.count - a.count)
                    .map(({ pillar, count, titles }) => (
                      <div key={pillar} className="p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center justify-between mb-2">
                          <PillarTag slug={pillar} />
                          <span className="text-xs font-mono font-bold" style={{ color: PILLAR_COLORS[pillar] ?? "var(--navy)" }}>
                            {count}
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {titles.map((t, i) => (
                            <li key={i} className="text-xs font-sans leading-snug" style={{ color: "var(--ink)" }}>
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              )}
            </section>

            {/* Blog post backlogs */}
            <section>
              <SectionHeader icon={Globe} label="Blog Post Queues" />
              <div className="space-y-3">
                {[
                  { key: "outOfOffice", label: "Out of Office", slug: "out-of-office", data: blogPosts.outOfOffice },
                  { key: "globalOffice", label: "Global Office", slug: "global-office", data: blogPosts.globalOffice },
                ].map(({ label, slug, data: bpData }) => (
                  <div key={slug} className="p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <PillarTag slug={slug} />
                      {bpData.publishedToday > 0 && (
                        <span className="text-2xs font-sans font-semibold" style={{ color: "#15803d" }}>
                          +{bpData.publishedToday} today
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs font-mono">
                      <span style={{ color: "var(--ink)" }}>
                        <span className="font-bold">{bpData.totalPublished}</span>
                        <span style={{ color: "var(--ink-m)" }}> published</span>
                      </span>
                      <span style={{ color: bpData.remaining > 0 ? "#d97706" : "#15803d" }}>
                        <span className="font-bold">{bpData.remaining}</span>
                        <span style={{ color: "var(--ink-m)" }}> remaining</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Comments */}
            <section>
              <SectionHeader icon={MessageSquare} label="Comments & Interactions" />
              <div className="grid grid-cols-2 gap-3 mb-3">
                <StatChip value={comments.newToday} label="New today" />
                <StatChip value={comments.approvedToday} label="Approved" color="#15803d" />
                <StatChip
                  value={comments.pendingModeration}
                  label="Pending"
                  color={comments.pendingModeration > 0 ? "#d97706" : "var(--navy)"}
                />
                <StatChip value={comments.likesToday} label="Likes today" color="#7c3aed" />
              </div>
              {comments.pendingModeration > 0 && (
                <a
                  href="/editorial/comments"
                  className="flex items-center gap-2 text-xs font-sans font-semibold px-3 py-2 transition-opacity hover:opacity-70"
                  style={{ background: "#fef3c7", border: "1px solid #d97706", color: "#92400e", borderRadius: "2px" }}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  {comments.pendingModeration} comment{comments.pendingModeration !== 1 ? "s" : ""} waiting for moderation
                </a>
              )}
            </section>

          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-8">

            {/* Social media */}
            <section>
              <SectionHeader icon={Share2} label="Social Media" />
              {social.byPlatform.length === 0 ? (
                <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>No posts generated today yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {["linkedin", "twitter", "instagram"].map((platform) => {
                      const p = social.byPlatform.find((x) => x.platform === platform);
                      return (
                        <div key={platform} className="p-3 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                          <div className="text-base font-mono font-bold mb-1" style={{ color: "var(--navy)" }}>
                            {PLATFORM_ICONS[platform]}
                          </div>
                          <div className="text-xl font-serif font-bold" style={{ color: "var(--navy)" }}>
                            {p?.total ?? 0}
                          </div>
                          <div className="text-2xs font-sans" style={{ color: "var(--ink-m)" }}>
                            {p ? `${p.published} sent · ${p.pending} pending` : "none"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {social.recent.length > 0 && (
                    <div className="space-y-2">
                      {social.recent.map((post, i) => (
                        <div key={i} className="flex items-start gap-2 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                          <span
                            className="text-2xs font-mono font-bold w-5 text-center flex-shrink-0 mt-0.5"
                            style={{ color: "var(--ink-m)" }}
                          >
                            {PLATFORM_ICONS[post.platform] ?? post.platform}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-sans leading-snug truncate" style={{ color: "var(--ink)" }}>
                              {post.headline}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <StatusDot ok={post.status === "published" || post.status === "sent"} warn={post.status === "pending_approval"} />
                              <span className="text-2xs font-mono" style={{ color: "var(--ink-m)" }}>
                                {post.status.replace(/_/g, " ")}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Newsletter */}
            <section>
              <SectionHeader icon={Mail} label="Newsletter" />
              <div className="p-4 mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  {newsletter.sentToday
                    ? <CheckCircle className="w-4 h-4" style={{ color: "#15803d" }} />
                    : <Clock className="w-4 h-4" style={{ color: "#d97706" }} />}
                  <span className="text-sm font-sans font-semibold" style={{ color: newsletter.sentToday ? "#15803d" : "#92400e" }}>
                    {newsletter.sentToday ? "Sent today" : newsletter.status === "sending" ? "Sending…" : "Not sent yet"}
                  </span>
                </div>
                {newsletter.subject && (
                  <p className="text-xs font-sans italic mb-3" style={{ color: "var(--ink-m)" }}>
                    &ldquo;{newsletter.subject}&rdquo;
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>
                      {newsletter.sentCount > 0 ? newsletter.sentCount.toLocaleString() : "—"}
                    </div>
                    <div className="text-2xs font-sans uppercase tracking-widest" style={{ color: "var(--ink-m)" }}>Sent</div>
                  </div>
                  <div>
                    <div className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>
                      {pct(newsletter.openRate)}
                    </div>
                    <div className="text-2xs font-sans uppercase tracking-widest" style={{ color: "var(--ink-m)" }}>Open rate</div>
                  </div>
                  <div>
                    <div className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>
                      {pct(newsletter.clickRate)}
                    </div>
                    <div className="text-2xs font-sans uppercase tracking-widest" style={{ color: "var(--ink-m)" }}>Click rate</div>
                  </div>
                  <div>
                    <div className="text-lg font-serif font-bold" style={{ color: newsletter.unsubscribeCount > 0 ? "#c8391a" : "var(--navy)" }}>
                      {newsletter.unsubscribeCount > 0 ? newsletter.unsubscribeCount : "—"}
                    </div>
                    <div className="text-2xs font-sans uppercase tracking-widest" style={{ color: "var(--ink-m)" }}>Unsubs</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatChip
                  value={newsletter.totalSubscribers.toLocaleString()}
                  label="Total subscribers"
                  color="#15803d"
                />
                <StatChip
                  value={newsletter.newToday > 0 ? `+${newsletter.newToday}` : "0"}
                  label="New today"
                  color={newsletter.newToday > 0 ? "#15803d" : "var(--navy)"}
                />
              </div>
            </section>

            {/* News intel */}
            <section>
              <SectionHeader icon={Rss} label="News Intelligence" />
              <div className="p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <StatusDot ok={newsIntel.ranToday} warn={!newsIntel.ranToday && !!newsIntel.lastRunAt} />
                  <span className="text-sm font-sans font-semibold" style={{ color: "var(--navy)" }}>
                    {newsIntel.ranToday
                      ? `Ran today at ${fmtTime(newsIntel.lastRunAt!)}`
                      : newsIntel.lastRunAt
                        ? `Last ran ${new Date(newsIntel.lastRunAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                        : "No runs recorded"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>{newsIntel.storiesFound}</div>
                    <div className="text-2xs font-sans uppercase tracking-widest" style={{ color: "var(--ink-m)" }}>Found</div>
                  </div>
                  <div>
                    <div className="text-lg font-serif font-bold" style={{ color: "#15803d" }}>{newsIntel.storiesStored}</div>
                    <div className="text-2xs font-sans uppercase tracking-widest" style={{ color: "var(--ink-m)" }}>Stored</div>
                  </div>
                  <div>
                    <div className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>{fmtMs(newsIntel.durationMs)}</div>
                    <div className="text-2xs font-sans uppercase tracking-widest" style={{ color: "var(--ink-m)" }}>Duration</div>
                  </div>
                </div>
                {newsIntel.errors.length > 0 && (
                  <div className="mt-3 text-2xs font-sans" style={{ color: "#c8391a" }}>
                    {newsIntel.errors.length} error{newsIntel.errors.length !== 1 ? "s" : ""} in last run
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="mt-8 pt-4 flex items-center gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <Briefcase className="w-3 h-3" style={{ color: "var(--ink-m)" }} />
          <span className="text-2xs font-mono" style={{ color: "var(--ink-m)" }}>
            Last updated {fmtTime(data.generatedAt)} · revalidates on refresh
          </span>
        </div>

      </div>
    </div>
  );
}
