"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle, XCircle, Loader2, RefreshCw, Send, ExternalLink, Mail, Eye, X,
} from "lucide-react";

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
  previewUrl: string;
  error?: string;
}

// ── Template list ─────────────────────────────────────────────────────────────

const TEMPLATES = [
  { key: "morning-brief", label: "Morning Brief" },
  { key: "confirmation",  label: "Confirmation"  },
  { key: "welcome",       label: "Welcome"       },
  { key: "unsubscribe",   label: "Unsubscribe"   },
] as const;

type TemplateKey = (typeof TEMPLATES)[number]["key"];

// ── Small helpers ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-base font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function ResultBox({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div
      className="p-4 text-sm font-sans mt-3"
      style={{
        background: ok ? "var(--surface)" : "#fef2f2",
        border: `1px solid ${ok ? "var(--border)" : "#fecaca"}`,
      }}
    >
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TestLab() {
  // Subscriber counts
  const [counts, setCounts]           = useState<SubscriberCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);

  // Subscribe flow
  const [subEmail, setSubEmail]       = useState("");
  const [subName, setSubName]         = useState("");
  const [subLoading, setSubLoading]   = useState(false);
  const [subResult, setSubResult]     = useState<SubscribeResult | null>(null);

  // Send test
  const [sendEmail, setSendEmail]     = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult]   = useState<SendResult | null>(null);

  // Inline preview
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey | null>(null);
  const [previewMode, setPreviewMode]       = useState<"template" | "live" | null>(null);

  const fetchCounts = useCallback(async () => {
    setCountsLoading(true);
    try {
      const res = await fetch("/api/test/newsletter/counts");
      if (res.ok) setCounts(await res.json() as SubscriberCounts);
    } finally {
      setCountsLoading(false);
    }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

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
      setSubResult(await res.json() as SubscribeResult);
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
      setSendResult(await res.json() as SendResult);
    } finally {
      setSendLoading(false);
    }
  }

  function openTemplate(key: TemplateKey) {
    setActiveTemplate(key);
    setPreviewMode("template");
  }

  function openLive() {
    setActiveTemplate(null);
    setPreviewMode("live");
  }

  function closePreview() {
    setPreviewMode(null);
    setActiveTemplate(null);
  }

  const iframeSrc =
    previewMode === "live"
      ? "/api/test/newsletter/preview"
      : activeTemplate
        ? `/api/test/newsletter/templates?template=${activeTemplate}`
        : null;

  const input = "text-sm font-sans px-3 py-2 outline-none";
  const inputStyle = { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)" };
  const btnPrimary = "flex items-center gap-1.5 text-sm font-sans font-semibold px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div>
      <p className="text-xs font-sans mb-8" style={{ color: "var(--ink-m)" }}>
        Pre-flight checks — send test emails, preview templates, and verify the subscription flow.
        Test routes return 403 in production unless{" "}
        <code className="font-mono" style={{ color: "var(--navy)" }}>ENABLE_TEST_ROUTES=true</code>.
      </p>

      {/* ── Template preview ── */}
      <Section title="Preview templates">
        <div className="flex gap-2 flex-wrap mb-4">
          {TEMPLATES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => openTemplate(key)}
              className={btnPrimary}
              style={{
                background: activeTemplate === key && previewMode === "template" ? "var(--red)" : "var(--navy)",
                color: "#fff",
                borderRadius: 2,
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
          <button
            onClick={openLive}
            className={btnPrimary}
            style={{
              background: previewMode === "live" ? "var(--red)" : "transparent",
              color: previewMode === "live" ? "#fff" : "var(--ink)",
              border: "1px solid var(--border)",
              borderRadius: 2,
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            Live Brief
          </button>
          {TEMPLATES.map(({ key, label }) => (
            <a
              key={`ext-${key}`}
              href={`/api/test/newsletter/templates?template=${key}`}
              target="_blank"
              rel="noreferrer"
              title={`Open ${label} in new tab`}
              className="flex items-center gap-1 text-xs font-sans px-2 py-2"
              style={{
                border: "1px solid var(--border)", borderRadius: 2,
                color: "var(--ink-m)", textDecoration: "none",
              }}
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          ))}
        </div>

        {/* Inline iframe */}
        {previewMode && iframeSrc && (
          <div style={{ border: "1px solid var(--border)", position: "relative" }}>
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
            >
              <span className="text-xs font-mono" style={{ color: "var(--ink-m)" }}>
                {previewMode === "live" ? "Live Morning Brief" : activeTemplate}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={iframeSrc}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-sans flex items-center gap-1"
                  style={{ color: "var(--navy)", textDecoration: "none" }}
                >
                  <ExternalLink className="w-3 h-3" /> Open in tab
                </a>
                <button onClick={closePreview} style={{ color: "var(--ink-m)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              className="w-full"
              style={{ height: 600, border: "none", display: "block" }}
              title="Email preview"
            />
          </div>
        )}
      </Section>

      <div style={{ borderTop: "1px solid var(--border)", marginBottom: "2.5rem" }} />

      {/* ── Send test email ── */}
      <Section title="Send test Morning Brief">
        <p className="text-xs font-sans mb-4" style={{ color: "var(--ink-m)" }}>
          Assembles today&apos;s content and sends to one address only — does not touch the subscriber list.
        </p>
        <form onSubmit={handleSend} className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={sendEmail}
            onChange={(e) => setSendEmail(e.target.value)}
            placeholder="test@example.com"
            required
            className={`${input} flex-1 min-w-64`}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={sendLoading || !sendEmail}
            className={btnPrimary}
            style={{ background: "var(--navy)", color: "#fff", borderRadius: 2 }}
          >
            {sendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {sendLoading ? "Sending…" : "Send to this address"}
          </button>
        </form>

        {sendResult && (
          <ResultBox ok={!sendResult.error}>
            {sendResult.error ? (
              <div className="flex items-center gap-2" style={{ color: "#b91c1c" }}>
                <XCircle className="w-4 h-4 flex-shrink-0" /> {sendResult.error}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2" style={{ color: "#15803d" }}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0" /> Sent to {sendResult.emailSentTo}
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    { label: "Articles", value: sendResult.articleCount },
                    { label: "Markets",  value: sendResult.marketSnapshotCount },
                    { label: "Water cooler", value: sendResult.hasWaterCooler ? "Yes" : "No" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="font-semibold uppercase tracking-wider mb-0.5"
                        style={{ color: "var(--ink-m)" }}>{label}</div>
                      <div className="font-mono font-bold" style={{ color: "var(--navy)" }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs font-mono italic" style={{ color: "var(--ink-m)" }}>
                  &ldquo;{sendResult.subject}&rdquo;
                </div>
                {sendResult.previewUrl && (
                  <a
                    href={sendResult.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-1.5"
                    style={{ border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink)", textDecoration: "none" }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Preview in Resend
                  </a>
                )}
              </div>
            )}
          </ResultBox>
        )}
      </Section>

      <div style={{ borderTop: "1px solid var(--border)", marginBottom: "2.5rem" }} />

      {/* ── Subscription flow ── */}
      <Section title="Test subscription flow">
        <p className="text-xs font-sans mb-4" style={{ color: "var(--ink-m)" }}>
          Runs the full double opt-in — creates a subscriber, sends the confirmation email, and returns the confirm URL so you can complete the flow without checking your inbox.
        </p>
        <form onSubmit={handleSubscribe} className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={subEmail}
            onChange={(e) => setSubEmail(e.target.value)}
            placeholder="email@example.com"
            required
            className={`${input} flex-1 min-w-48`}
            style={inputStyle}
          />
          <input
            type="text"
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            placeholder="First name (optional)"
            className={`${input} w-44`}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={subLoading || !subEmail}
            className={btnPrimary}
            style={{ background: "var(--red)", color: "#fff", borderRadius: 2 }}
          >
            {subLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {subLoading ? "Subscribing…" : "Subscribe"}
          </button>
        </form>

        {subResult && (
          <ResultBox ok={!subResult.error}>
            {subResult.error ? (
              <div className="flex items-center gap-2" style={{ color: "#b91c1c" }}>
                <XCircle className="w-4 h-4 flex-shrink-0" /> {subResult.error}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2" style={{ color: "#15803d" }}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  Subscriber created
                  {subResult.emailSent ? " · confirmation email sent" : " · email skipped (check RESEND_API_KEY)"}
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider mr-2" style={{ color: "var(--ink-m)" }}>
                    Confirm URL
                  </span>
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
              </div>
            )}
          </ResultBox>
        )}
      </Section>

      <div style={{ borderTop: "1px solid var(--border)", marginBottom: "2.5rem" }} />

      {/* ── Subscriber counts ── */}
      <Section title="Subscriber counts">
        <div className="flex items-center gap-3 mb-4">
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

        {counts ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "pending",      count: counts.pending,      color: "#b45309" },
                { label: "confirmed",    count: counts.confirmed,    color: "#15803d" },
                { label: "unsubscribed", count: counts.unsubscribed, color: "#6b7280" },
                { label: "bounced",      count: counts.bounced,      color: "#b91c1c" },
              ].map(({ label, count, color }) => (
                <div
                  key={label}
                  className="flex flex-col items-center px-4 py-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <span className="text-xl font-mono font-bold" style={{ color }}>{count}</span>
                  <span className="text-xs font-sans mt-0.5 capitalize" style={{ color: "var(--ink-m)" }}>{label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-mono" style={{ color: "var(--ink-m)" }}>
              Total: <strong style={{ color: "var(--ink)" }}>{counts.total}</strong>
            </p>
          </div>
        ) : (
          <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>
            {countsLoading ? "Loading…" : "Not loaded."}
          </p>
        )}
      </Section>
    </div>
  );
}
