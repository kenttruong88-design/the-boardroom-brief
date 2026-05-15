"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, Loader2, RefreshCw, Send, ExternalLink, Mail, Eye,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubscriberCounts {
  pending: number;
  confirmed: number;
  unsubscribed: number;
  bounced: number;
  total: number;
}

interface SubscribeResult {
  subscriberId: string | null;
  confirmationToken: string;
  confirmUrl: string;
  emailSent: boolean;
  error?: string;
}

interface SendResult {
  subject: string;
  introText: string;
  articleCount: number;
  marketSnapshotCount: number;
  hasWaterCooler: boolean;
  emailSentTo: string;
  resendEmailId: string;
  previewUrl: string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span className="text-lg font-mono font-bold" style={{ color }}>{count}</span>
      <span className="text-xs font-sans mt-0.5" style={{ color: "var(--ink-m)" }}>{label}</span>
    </div>
  );
}

const TEMPLATES = [
  { key: "confirmation",   label: "Confirmation" },
  { key: "welcome",        label: "Welcome" },
  { key: "morning-brief",  label: "Morning Brief" },
  { key: "unsubscribe",    label: "Unsubscribe" },
] as const;

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NewsletterTestPage() {
  const router = useRouter();

  const [authed, setAuthed] = useState<boolean | null>(null);

  // Subscriber counts
  const [counts, setCounts]       = useState<SubscriberCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);

  // Subscribe flow
  const [subEmail, setSubEmail]   = useState("");
  const [subName, setSubName]     = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subResult, setSubResult] = useState<SubscribeResult | null>(null);

  // Send test
  const [sendEmail, setSendEmail] = useState(process.env.NEXT_PUBLIC_EDITOR_EMAIL ?? "");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  // Auth check
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else setAuthed(true);
    });
  }, [router]);

  const fetchCounts = useCallback(async () => {
    setCountsLoading(true);
    try {
      const res = await fetch("/api/test/newsletter/counts");
      if (res.ok) setCounts(await res.json() as SubscriberCounts);
    } finally {
      setCountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) fetchCounts();
  }, [authed, fetchCounts]);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setSubLoading(true);
    setSubResult(null);
    try {
      const res = await fetch("/api/test/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: subEmail, firstName: subName || undefined }),
      });
      const data = await res.json() as SubscribeResult;
      setSubResult(data);
      fetchCounts();
    } finally {
      setSubLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSendLoading(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/test/newsletter/send?email=${encodeURIComponent(sendEmail)}`);
      const data = await res.json() as SendResult;
      setSendResult(data);
    } finally {
      setSendLoading(false);
    }
  }

  if (authed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--navy)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold" style={{ color: "var(--navy)" }}>
            Newsletter test lab
          </h1>
          <p className="text-sm font-sans mt-1" style={{ color: "var(--ink-m)" }}>
            Pre-flight checks before going live. All routes return 403 in production.
          </p>
        </div>

        {/* ── Template preview ── */}
        <section className="mb-10">
          <h2 className="text-lg font-serif font-bold mb-1" style={{ color: "var(--navy)" }}>
            <Eye className="inline w-5 h-5 mr-1" />
            Preview templates
          </h2>
          <p className="text-xs font-sans mb-4" style={{ color: "var(--ink-m)" }}>
            Opens the rendered HTML in a new tab — uses mock data.
          </p>
          <div className="flex gap-3 flex-wrap">
            {TEMPLATES.map(({ key, label }) => (
              <a
                key={key}
                href={`/api/test/newsletter/templates?template=${key}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2"
                style={{
                  background: "var(--navy)", color: "#fff",
                  borderRadius: 2, textDecoration: "none",
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {label}
              </a>
            ))}
            <a
              href="/api/test/newsletter/preview"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2"
              style={{
                border: "1px solid var(--border)", color: "var(--ink)",
                borderRadius: 2, textDecoration: "none",
                background: "var(--surface)",
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Live Morning Brief
            </a>
          </div>
        </section>

        <div className="rule mb-10" />

        {/* ── Subscription flow test ── */}
        <section className="mb-10">
          <h2 className="text-lg font-serif font-bold mb-1" style={{ color: "var(--navy)" }}>
            <Mail className="inline w-5 h-5 mr-1" />
            Test subscription flow
          </h2>
          <p className="text-xs font-sans mb-4" style={{ color: "var(--ink-m)" }}>
            Runs the complete double opt-in flow and sends the real confirmation email.
            Returns the confirm URL so you can test without checking your inbox.
          </p>

          <form onSubmit={handleSubscribe} className="flex gap-2 flex-wrap mb-4">
            <input
              type="email"
              value={subEmail}
              onChange={(e) => setSubEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="text-sm font-sans px-3 py-2 flex-1 min-w-48"
              style={{
                border: "1px solid var(--border)", background: "var(--surface)",
                color: "var(--ink)", outline: "none",
              }}
            />
            <input
              type="text"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="First name (optional)"
              className="text-sm font-sans px-3 py-2 w-48"
              style={{
                border: "1px solid var(--border)", background: "var(--surface)",
                color: "var(--ink)", outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={subLoading || !subEmail}
              className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2"
              style={{
                background: subLoading || !subEmail ? "#ccc" : "var(--red)",
                color: "#fff", borderRadius: 2,
                cursor: subLoading || !subEmail ? "not-allowed" : "pointer",
              }}
            >
              {subLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Subscribe
            </button>
          </form>

          {subResult && (
            <div
              className="p-4 text-sm font-sans"
              style={{
                background: subResult.error ? "#fef2f2" : "#f0fdf4",
                border: `1px solid ${subResult.error ? "#fecaca" : "#bbf7d0"}`,
              }}
            >
              {subResult.error ? (
                <div className="flex items-center gap-2" style={{ color: "#b91c1c" }}>
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  {subResult.error}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2" style={{ color: "#15803d" }}>
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Subscriber created{" "}
                      {subResult.emailSent ? "· confirmation email sent" : "· email not sent (check RESEND_API_KEY)"}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold" style={{ color: "var(--ink-m)" }}>Confirm URL: </span>
                    <a
                      href={subResult.confirmUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs break-all"
                      style={{ color: "var(--navy)", textDecoration: "underline" }}
                    >
                      {subResult.confirmUrl}
                    </a>
                  </div>
                  {subResult.subscriberId && (
                    <div className="text-xs font-mono" style={{ color: "var(--ink-m)" }}>
                      ID: {subResult.subscriberId}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="rule mb-10" />

        {/* ── Send test morning brief ── */}
        <section className="mb-10">
          <h2 className="text-lg font-serif font-bold mb-1" style={{ color: "var(--navy)" }}>
            <Send className="inline w-5 h-5 mr-1" />
            Send test Morning Brief
          </h2>
          <p className="text-xs font-sans mb-4" style={{ color: "var(--ink-m)" }}>
            Assembles today&apos;s content and sends to one address only — does not touch the full subscriber list.
          </p>

          <form onSubmit={handleSend} className="flex gap-2 flex-wrap mb-4">
            <input
              type="email"
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              placeholder="test@example.com"
              required
              className="text-sm font-sans px-3 py-2 flex-1 min-w-64"
              style={{
                border: "1px solid var(--border)", background: "var(--surface)",
                color: "var(--ink)", outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={sendLoading || !sendEmail}
              className="flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2"
              style={{
                background: sendLoading || !sendEmail ? "#ccc" : "var(--navy)",
                color: "#fff", borderRadius: 2,
                cursor: sendLoading || !sendEmail ? "not-allowed" : "pointer",
              }}
            >
              {sendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send to this email
            </button>
          </form>

          {sendResult && (
            <div
              className="p-4 text-sm font-sans"
              style={{
                background: sendResult.error ? "#fef2f2" : "var(--surface)",
                border: `1px solid ${sendResult.error ? "#fecaca" : "var(--border)"}`,
              }}
            >
              {sendResult.error ? (
                <div className="flex items-center gap-2" style={{ color: "#b91c1c" }}>
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  {sendResult.error}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2" style={{ color: "#15803d" }}>
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    Sent to {sendResult.emailSentTo}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider mb-1"
                      style={{ color: "var(--ink-m)" }}>
                      Subject
                    </div>
                    <div className="font-mono text-xs" style={{ color: "var(--ink)" }}>
                      {sendResult.subject}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                        style={{ color: "var(--ink-m)" }}>Articles</div>
                      <div className="font-mono font-bold" style={{ color: "var(--navy)" }}>
                        {sendResult.articleCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                        style={{ color: "var(--ink-m)" }}>Markets</div>
                      <div className="font-mono font-bold" style={{ color: "var(--navy)" }}>
                        {sendResult.marketSnapshotCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                        style={{ color: "var(--ink-m)" }}>Water cooler</div>
                      <div className="font-mono font-bold" style={{ color: "var(--navy)" }}>
                        {sendResult.hasWaterCooler ? "Yes" : "No"}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-sans leading-relaxed mb-2"
                      style={{ color: "var(--ink-m)", fontStyle: "italic" }}>
                      &ldquo;{sendResult.introText}&rdquo;
                    </div>
                  </div>
                  <a
                    href={sendResult.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-1.5"
                    style={{
                      border: "1px solid var(--border)", borderRadius: 2,
                      color: "var(--ink)", textDecoration: "none",
                      background: "var(--cream)",
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Preview in Resend
                  </a>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="rule mb-10" />

        {/* ── Subscriber counts ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif font-bold" style={{ color: "var(--navy)" }}>
              Subscriber counts
            </h2>
            <button
              onClick={fetchCounts}
              disabled={countsLoading}
              className="flex items-center gap-1.5 text-xs font-sans px-3 py-1.5"
              style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)" }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${countsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {counts === null ? (
            <div className="text-sm font-sans py-4" style={{ color: "var(--ink-m)" }}>
              {countsLoading ? "Loading…" : "Not loaded yet."}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatusPill label="pending"      count={counts.pending}      color="#b45309" />
                <StatusPill label="confirmed"    count={counts.confirmed}    color="#15803d" />
                <StatusPill label="unsubscribed" count={counts.unsubscribed} color="#6b7280" />
                <StatusPill label="bounced"      count={counts.bounced}      color="#b91c1c" />
              </div>
              <div className="text-xs font-mono" style={{ color: "var(--ink-m)" }}>
                Total: <strong style={{ color: "var(--ink)" }}>{counts.total}</strong>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
