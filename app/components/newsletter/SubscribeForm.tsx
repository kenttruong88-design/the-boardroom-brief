"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { events } from "@/app/lib/analytics";

type Status = "idle" | "submitting" | "success" | "error";

interface Props {
  source?: string;
  articleSlug?: string;
  compact?: boolean;
  dark?: boolean;
}

export default function SubscribeForm({
  source = "website",
  articleSlug,
  compact = false,
  dark = false,
}: Props) {
  const posthog = usePostHog();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName: firstName.trim() || undefined,
          source,
          sourceArticleSlug: articleSlug,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };

      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
      } else {
        setStatus("success");
        posthog?.capture("newsletter_signup", { source, article_slug: articleSlug ?? null });
        events.newsletterSignup(source);
      }
    } catch {
      setErrorMsg("Connection failed. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: "#16a34a" }} />
        <p className="font-serif font-bold text-base mb-1" style={{ color: dark ? "var(--cream)" : "var(--navy)" }}>
          Check your inbox
        </p>
        <p className="text-sm font-sans" style={{ color: dark ? "rgba(245,240,232,0.65)" : "var(--ink-m)" }}>
          We sent a confirmation link to{" "}
          <strong style={{ color: dark ? "var(--cream)" : "var(--ink)" }}>{email}</strong>.
          Click it to start receiving the Morning Brief.
        </p>
        <p className="text-xs font-sans mt-2" style={{ color: dark ? "rgba(245,240,232,0.45)" : "var(--ink-m)" }}>
          Can&apos;t find it? Check your spam folder.
        </p>
      </div>
    );
  }

  const inputStyle = dark
    ? { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.18)", color: "var(--cream)", borderRadius: "2px" }
    : { background: "var(--cream)", border: "1px solid var(--border)", color: "var(--ink)", borderRadius: "2px" };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          disabled={status === "submitting"}
          className="flex-1 text-sm font-sans px-3 py-2.5 outline-none min-w-0 disabled:opacity-60"
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="btn-red flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
        >
          {status === "submitting" ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Subscribing...</>
          ) : (
            "Get the Brief"
          )}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="First name (optional)"
        disabled={status === "submitting"}
        className="w-full text-sm font-sans px-4 py-3 outline-none disabled:opacity-60"
        style={inputStyle}
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        disabled={status === "submitting"}
        className="w-full text-sm font-sans px-4 py-3 outline-none disabled:opacity-60"
        style={inputStyle}
      />
      {status === "error" && (
        <div className="flex items-center gap-2 text-sm font-sans" style={{ color: "#f87171" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errorMsg}
        </div>
      )}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="btn-red w-full flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {status === "submitting" ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Subscribing...</>
        ) : (
          "Get the Morning Brief"
        )}
      </button>
      <p className="text-xs font-sans text-center" style={{ color: dark ? "rgba(245,240,232,0.4)" : "var(--ink-m)" }}>
        Free &middot; No spam &middot; Unsubscribe anytime
      </p>
    </form>
  );
}
