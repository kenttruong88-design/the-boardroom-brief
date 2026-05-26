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
    <div className="min-h-screen bg-cream-100 dark:bg-navy-500">
      <div className="site-container py-20">
        <div className="max-w-xl mx-auto">

          {/* Confirmation */}
          <div className="text-center mb-12">
            <p className="font-body text-xs font-bold tracking-widest uppercase text-red-500 mb-4">
              Unsubscribed
            </p>
            <h1 className="font-headline font-black text-4xl text-navy-500 dark:text-cream-100 tracking-tight mb-4">
              You&apos;ve been unsubscribed.
            </h1>
            <p className="font-body text-base text-ink-muted dark:text-cream-300 mb-8">
              Sorry to see you go. No further Morning Briefs will be sent to your address.
            </p>
            <Link
              href="/subscribe"
              className="inline-block font-body text-xs font-bold tracking-widest uppercase px-5 py-2.5 bg-red-500 text-cream-100 no-underline hover:bg-navy-500 dark:hover:bg-cream-200 dark:hover:text-navy-500 transition-colors duration-[120ms]"
            >
              Resubscribe
            </Link>
          </div>

          <div className="border-t border-rule dark:border-rule-dark mb-8" />

          {/* Optional feedback */}
          <div>
            <h2 className="font-headline font-bold text-xl text-navy-500 dark:text-cream-100 mb-2">
              What could we do better?
            </h2>
            <p className="font-body text-sm text-ink-muted dark:text-cream-300 mb-5">
              Completely optional. Takes 30 seconds. Genuinely read by the editorial team.
            </p>

            {feedbackStatus === "sent" ? (
              <div className="flex items-center gap-2 font-body text-sm text-green-600 dark:text-green-400">
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
                  className="w-full font-body text-sm px-4 py-3 outline-none resize-none bg-cream-200 dark:bg-navy-400 border border-rule dark:border-rule-dark text-ink dark:text-cream-100 placeholder:text-ink-faint dark:placeholder:text-cream-500"
                />
                <button
                  type="submit"
                  disabled={!feedback.trim() || feedbackStatus === "sending"}
                  className="flex items-center gap-2 font-body text-xs font-bold tracking-widest uppercase px-4 py-2 border border-navy-500 dark:border-cream-300 text-navy-500 dark:text-cream-100 hover:bg-navy-500 hover:text-cream-100 dark:hover:bg-cream-200 dark:hover:text-navy-500 transition-colors duration-[120ms] disabled:opacity-40"
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
