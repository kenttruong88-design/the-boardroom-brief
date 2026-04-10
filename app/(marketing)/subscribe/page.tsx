"use client";

import { useState } from "react";
import { Check } from "lucide-react";

const PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Five stories every morning. No credit card required.",
    cta: "Start reading",
    href: "/",
    features: [
      "Morning Brief newsletter",
      "3 full articles/day",
      "Markets ticker",
      "30 economy snapshots",
    ],
    highlight: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    description: "Everything in Free, plus unlimited access and no ads.",
    cta: "Subscribe",
    priceId: PRICE_ID,
    features: [
      "Everything in Free",
      "Unlimited article access",
      "No ads",
      "Weekly Digest email",
      "Full earnings coverage",
      "Early access to new features",
    ],
    highlight: true,
  },
  {
    name: "Corporate",
    price: "$49",
    period: "/month",
    description: "Team access for up to 10 seats.",
    cta: "Contact us",
    href: "mailto:hello@theboardroombrief.com",
    features: [
      "Everything in Pro",
      "Up to 10 team seats",
      "Custom newsletter digest",
      "Priority support",
      "Invoice billing",
    ],
    highlight: false,
  },
];

export default function SubscribePage() {
  const [loading, setLoading] = useState(false);

  async function handleProCheckout() {
    if (!PRICE_ID) {
      alert("Stripe not configured yet — check back soon.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: PRICE_ID }),
      });
      const { url } = await res.json() as { url?: string };
      if (url) window.location.href = url;
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="container-editorial py-20">
        <div className="text-center mb-14">
          <p className="eyebrow mb-3">Pricing</p>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold" style={{ color: "var(--navy)" }}>
            Intelligence worth paying for.
          </h1>
          <p className="text-lg font-sans mt-4 max-w-xl mx-auto" style={{ color: "var(--ink-m)" }}>
            Real markets. Real news. Questionable corporate poetry — starting free.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="flex flex-col p-8"
              style={{
                background: tier.highlight ? "var(--navy)" : "var(--surface)",
                border: tier.highlight ? "2px solid var(--red)" : "1px solid var(--border)",
              }}
            >
              {tier.highlight && (
                <p className="text-xs font-sans font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--gold)" }}>
                  Most Popular
                </p>
              )}
              <h2
                className="text-xl font-serif font-bold"
                style={{ color: tier.highlight ? "var(--cream)" : "var(--navy)" }}
              >
                {tier.name}
              </h2>
              <div className="flex items-end gap-1 mt-2 mb-1">
                <span
                  className="text-4xl font-serif font-bold"
                  style={{ color: tier.highlight ? "var(--cream)" : "var(--navy)" }}
                >
                  {tier.price}
                </span>
                <span className="text-sm font-sans mb-1" style={{ color: tier.highlight ? "rgba(245,240,232,0.5)" : "var(--ink-m)" }}>
                  {tier.period}
                </span>
              </div>
              <p className="text-sm font-sans mb-6" style={{ color: tier.highlight ? "rgba(245,240,232,0.65)" : "var(--ink-m)" }}>
                {tier.description}
              </p>

              <ul className="space-y-2.5 mb-8 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm font-sans" style={{ color: tier.highlight ? "rgba(245,240,232,0.85)" : "var(--ink)" }}>
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: tier.highlight ? "var(--gold)" : "var(--red)" }} />
                    {f}
                  </li>
                ))}
              </ul>

              {tier.priceId !== undefined ? (
                <button
                  onClick={handleProCheckout}
                  disabled={loading}
                  className="btn-red w-full text-center disabled:opacity-60"
                >
                  {loading ? "Redirecting…" : tier.cta}
                </button>
              ) : tier.href?.startsWith("mailto") ? (
                <a href={tier.href} className="btn-outline w-full text-center" style={{ border: "1px solid var(--border)", color: "var(--navy)" }}>
                  {tier.cta}
                </a>
              ) : (
                <a href={tier.href} className="btn-outline w-full text-center" style={{ border: "1px solid var(--border)", color: "var(--navy)" }}>
                  {tier.cta}
                </a>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-sm font-sans mt-8" style={{ color: "var(--ink-m)" }}>
          Cancel anytime. No dark patterns. We&apos;re journalists, not growth hackers.
        </p>
      </div>
    </div>
  );
}
