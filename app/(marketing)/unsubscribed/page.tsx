"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function UnsubscribedPage() {
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!feedback.trim()) return;
    setFeedbackStatus("sending");

    try {
      await fetch("/api/newsletter/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: feedback }),
      });
    } finally {
      setFeedbackStatus("sent");
    }
  }

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="container-editorial py-20">
        <div className="max-w-xl mx-auto">

          {/* Confirmation */}
          <div className="text-center mb-12">
            <p className="eyebrow mb-4" style={{ color: "var(--red)" }}>
              Unsubscribed
            </p>
            <h1
              className="text-4xl font-serif font-bold mb-4"
              style={{ color: "var(--navy)" }}
            >
              You&apos;ve been unsubscribed.
            </h1>
            <p className="text-base font-sans mb-8" style={{ color: "var(--ink-m)" }}>
              Sorry to see you go. No further Morning Briefs will be sent to
              your address.
            </p>

            <Link href="/subscribe" className="btn-red inline-block">
              Resubscribe
            </Link>
          </div>

          <div className="rule mb-8" />

          {/* Feedback form */}
          <div>
            <h2
              className="font-serif font-bold text-lg mb-2"
              style={{ color: "var(--navy)" }}
            >
              What could we do better?
            </h2>
            <p
              className="text-sm font-sans mb-5"
              style={{ color: "var(--ink-m)" }}
            >
              Completely optional. Takes 30 seconds. Genuinely read by the
              editorial team.
            </p>

            {feedbackStatus === "sent" ? (
              <div className="flex items-center gap-2 text-sm font-sans" style={{ color: "#16a34a" }}>
                <CheckCircle2 className="w-4 h-4" />
                Thanks — feedback received.
              </div>
            ) : (
              <form onSubmit={submitFeedback} className="space-y-3">
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Too many emails, wrong topics, just not my thing…"
                  rows={4}
                  className="w-full text-sm font-sans px-4 py-3 outline-none resize-none"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--ink)",
                    borderRadius: "2px",
                  }}
                />
                <button
                  type="submit"
                  disabled={!feedback.trim() || feedbackStatus === "sending"}
                  className="btn-outline flex items-center gap-2 disabled:opacity-40"
                >
                  {feedbackStatus === "sending" ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                  ) : (
                    "Send feedback"
                  )}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
