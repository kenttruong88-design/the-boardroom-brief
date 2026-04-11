"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { PILLARS, ECONOMIES } from "@/app/lib/mock-data";

const REGIONS = ["Americas", "Europe", "Asia-Pacific", "Middle East & Africa"];

function WelcomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") ?? "";

  const [selectedPillars, setSelectedPillars] = useState<string[]>([]);
  const [selectedEconomies, setSelectedEconomies] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function togglePillar(slug: string) {
    setSelectedPillars((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function toggleEconomy(slug: string) {
    setSelectedEconomies((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  async function handleSave() {
    setSaving(true);
    const segments = [
      ...selectedPillars.map((s) => `pillar:${s}`),
      ...selectedEconomies.map((s) => `economy:${s}`),
    ];

    await fetch("/api/subscribe/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, segments }),
    }).catch(() => null);

    setSaving(false);
    setSaved(true);
    setTimeout(() => router.push("/"), 2000);
  }

  if (saved) {
    return (
      <div className="text-center py-20">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: "#ea580c" }} />
        <h2 className="text-2xl font-serif font-bold mb-2" style={{ color: "var(--navy)" }}>
          You're all set.
        </h2>
        <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>
          Your first brief arrives tomorrow morning. Redirecting you now…
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="text-center mb-12">
        <p className="eyebrow-gold mb-2" style={{ color: "var(--gold)" }}>
          Welcome to The Alignment Times
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-3" style={{ color: "var(--navy)" }}>
          Personalise your brief.
        </h1>
        <p className="text-base font-sans max-w-md mx-auto" style={{ color: "var(--ink-m)" }}>
          Tell us what you care about and we'll tailor your daily digest accordingly.
          {email && (
            <span className="block mt-1 text-sm" style={{ color: "var(--ink-m)" }}>
              Sending to <strong>{email}</strong>
            </span>
          )}
        </p>
      </div>

      {/* Pillar selection */}
      <section className="mb-10">
        <div className="rule-thick mb-5" />
        <h2 className="eyebrow mb-5">Which sections matter to you?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PILLARS.map((pillar) => {
            const selected = selectedPillars.includes(pillar.slug);
            return (
              <button
                key={pillar.slug}
                onClick={() => togglePillar(pillar.slug)}
                className="text-left p-4 transition-all"
                style={{
                  border: `2px solid ${selected ? "var(--red)" : "var(--border)"}`,
                  background: selected ? "rgba(200,57,26,0.04)" : "var(--surface)",
                  borderRadius: "2px",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`pillar-badge text-2xs ${pillar.color}`}>{pillar.name}</span>
                    <p className="text-xs font-sans mt-1.5 leading-relaxed" style={{ color: "var(--ink-m)" }}>
                      {pillar.description}
                    </p>
                  </div>
                  {selected && (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--red)" }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Economy selection */}
      <section className="mb-10">
        <div className="rule-thick mb-5" />
        <h2 className="eyebrow mb-2">Which economies do you follow?</h2>
        <p className="text-xs font-sans mb-6" style={{ color: "var(--ink-m)" }}>
          Select up to 10. We'll prioritise coverage from these markets in your daily brief.
        </p>
        <div className="space-y-8">
          {REGIONS.map((region) => {
            const economies = ECONOMIES.filter((e) => e.region === region);
            return (
              <div key={region}>
                <p className="eyebrow-muted text-2xs mb-3">{region}</p>
                <div className="flex flex-wrap gap-2">
                  {economies.map((eco) => {
                    const selected = selectedEconomies.includes(eco.slug);
                    return (
                      <button
                        key={eco.slug}
                        onClick={() => {
                          if (!selected && selectedEconomies.length >= 10) return;
                          toggleEconomy(eco.slug);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-all"
                        style={{
                          border: `1px solid ${selected ? "var(--red)" : "var(--border)"}`,
                          background: selected ? "rgba(200,57,26,0.06)" : "var(--surface)",
                          color: selected ? "var(--red)" : "var(--ink-m)",
                          borderRadius: "2px",
                          opacity: !selected && selectedEconomies.length >= 10 ? 0.4 : 1,
                        }}
                      >
                        {eco.flag} {eco.code}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Save */}
      <div className="text-center pt-4 pb-16">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-red px-10"
        >
          {saving ? "Saving…" : "Save my preferences"}
        </button>
        <button
          onClick={() => router.push("/")}
          className="block mx-auto mt-4 text-sm font-sans underline hover:opacity-70"
          style={{ color: "var(--ink-m)" }}
        >
          Skip for now
        </button>
      </div>
    </>
  );
}

export default function WelcomePage() {
  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="container-editorial py-12 max-w-3xl mx-auto">
        <Suspense fallback={<div className="text-center py-20 font-sans text-sm" style={{ color: "var(--ink-m)" }}>Loading…</div>}>
          <WelcomeContent />
        </Suspense>
      </div>
    </div>
  );
}
