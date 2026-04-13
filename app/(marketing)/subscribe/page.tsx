"use client";

import { useState } from "react";
import { Mail, Check } from "lucide-react";

export default function SubscribePage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "subscribe-page" }),
      });
      const data = await res.json() as { message?: string; error?: string };

      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="container-editorial py-20">

        {/* Header */}
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <p className="eyebrow mb-3">Daily Newsletter</p>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>
            Five stories. Every morning. Free.
          </h1>
          <p className="text-lg font-sans" style={{ color: "var(--ink-m)" }}>
            The Alignment Times delivers economic intelligence across five continents — markets, policy, and power — straight to your inbox before the market opens.
          </p>
        </div>

        {/* Form card */}
        <div className="max-w-md mx-auto">
          {status === "success" ? (
            <div className="text-center p-10" style={{ background: "var(--navy)" }}>
              <div
                className="w-14 h-14 flex items-center justify-center mx-auto mb-5"
                style={{ background: "var(--red)", borderRadius: "2px" }}
              >
                <Mail className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-serif font-bold mb-3" style={{ color: "var(--cream)" }}>
                Check your inbox
              </h2>
              <p className="text-sm font-sans" style={{ color: "rgba(245,240,232,0.7)" }}>
                We sent a confirmation link to <strong style={{ color: "var(--cream)" }}>{email}</strong>. Click it to activate your subscription.
              </p>
            </div>
          ) : (
            <div className="p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="eyebrow-muted block mb-2">Your email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full text-base font-sans px-4 py-3 outline-none"
                    style={{
                      background: "var(--cream)",
                      border: "1px solid var(--border)",
                      color: "var(--ink)",
                      borderRadius: "2px",
                    }}
                  />
                </div>

                {status === "error" && (
                  <p className="text-sm font-sans" style={{ color: "var(--red)" }}>{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="btn-red w-full flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Mail className="w-4 h-4" />
                  {status === "loading" ? "Subscribing…" : "Subscribe — it's free"}
                </button>
              </form>

              <p className="text-xs font-sans text-center mt-4" style={{ color: "var(--ink-m)" }}>
                No spam. No paid tiers. Unsubscribe any time.
              </p>
            </div>
          )}
        </div>

        {/* What you get */}
        <div className="max-w-2xl mx-auto mt-16">
          <div className="rule-thick mb-8" />
          <h2 className="text-xl font-serif font-bold mb-6 text-center" style={{ color: "var(--navy)" }}>
            What's in every edition
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "Markets Floor", body: "Indices, forex, and commodities — what moved and why." },
              { title: "C-Suite Circus", body: "Executive moves, boardroom strategy, and corporate theatre." },
              { title: "Global Office", body: "International business, geopolitics, and trade." },
              { title: "Water Cooler", body: "Corporate culture and workplace absurdity, served dry." },
              { title: "Off The Record", body: "Podcast picks — unfiltered conversations on leadership." },
              { title: "5 Continents", body: "One macro signal per region, every morning." },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 p-4" style={{ border: "1px solid var(--border)" }}>
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--red)" }} />
                <div>
                  <p className="text-sm font-sans font-semibold" style={{ color: "var(--navy)" }}>{item.title}</p>
                  <p className="text-sm font-sans mt-0.5" style={{ color: "var(--ink-m)" }}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
