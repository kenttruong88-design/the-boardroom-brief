"use client";

import { useEffect, useRef, useState } from "react";
import { X, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";

interface Quote {
  symbol: string;
  name: string;
  economyId: string;
  price: number;
  changePct: number;
  change: number;
}

interface SlideOverProps {
  quote: Quote;
  onClose: () => void;
}

function SlideOver({ quote, onClose }: SlideOverProps) {
  const up = quote.changePct >= 0;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(15,25,35,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm h-full overflow-y-auto"
        style={{ background: "var(--cream)", borderLeft: "1px solid var(--border)" }}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="eyebrow-muted text-2xs mb-1">{quote.symbol}</p>
              <h3 className="text-xl font-serif font-bold" style={{ color: "var(--navy)" }}>
                {quote.name}
              </h3>
            </div>
            <button onClick={onClose} className="p-1 hover:opacity-60" style={{ color: "var(--ink-m)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Price */}
          <div className="mb-6 p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div
              className="text-3xl font-bold mb-1"
              style={{ color: "var(--navy)", fontFamily: "var(--font-jetbrains)" }}
            >
              {quote.price.toLocaleString("en-US", { maximumFractionDigits: 4 })}
            </div>
            <div className="flex items-center gap-2">
              {up
                ? <TrendingUp className="w-4 h-4" style={{ color: "#ea580c" }} />
                : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />}
              <span
                className="text-sm font-semibold"
                style={{ color: up ? "#ea580c" : "#dc2626", fontFamily: "var(--font-jetbrains)" }}
              >
                {up ? "+" : ""}{quote.changePct.toFixed(2)}%
              </span>
              <span className="text-xs" style={{ color: "var(--ink-m)" }}>today</span>
            </div>
          </div>

          {/* Mini sparkline placeholder */}
          <div className="mb-6">
            <p className="eyebrow-muted text-2xs mb-3">7-Day Performance</p>
            <div
              className="h-24 flex items-end gap-0.5 p-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {[55, 62, 48, 70, 65, 80, up ? 88 : 44].map((h, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{
                    height: `${h}%`,
                    background: up ? "#ea580c" : "#dc2626",
                    opacity: 0.4 + (i / 7) * 0.6,
                    borderRadius: "1px 1px 0 0",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Time range buttons */}
          <div className="flex gap-1 mb-6">
            {["1D", "1W", "1M", "3M", "1Y"].map((range) => (
              <button
                key={range}
                className="px-3 py-1.5 text-2xs font-mono transition-colors"
                style={{
                  background: range === "1D" ? "var(--navy)" : "var(--surface)",
                  color: range === "1D" ? "var(--cream)" : "var(--ink-m)",
                  border: "1px solid var(--border)",
                  borderRadius: "2px",
                }}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Related articles link */}
          <div>
            <div className="rule-thick mb-3" />
            <p className="eyebrow-muted text-2xs mb-3">Related coverage</p>
            <a
              href={`/economies/${quote.economyId}`}
              className="flex items-center justify-between py-3 text-sm font-sans font-semibold hover:opacity-70 transition-opacity"
              style={{ color: "var(--navy)" }}
            >
              View {quote.name} economy page
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MarketTicker() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState<Quote | null>(null);
  const tickerRef = useRef<HTMLDivElement>(null);

  async function loadQuotes() {
    try {
      const res = await fetch("/api/markets");
      if (res.ok) {
        const data = await res.json();
        setQuotes(data);
      }
    } catch {
      // silent — ticker just stays empty
    }
  }

  useEffect(() => {
    loadQuotes();
    const interval = setInterval(loadQuotes, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  if (dismissed || quotes.length === 0) return null;

  // Duplicate for seamless loop
  const items = [...quotes, ...quotes];

  return (
    <>
      <div
        className="relative overflow-hidden"
        style={{
          background: "var(--navy)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          height: "32px",
        }}
      >
        {/* Live badge */}
        <div
          className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 gap-1.5"
          style={{ background: "var(--red)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-2xs font-mono font-bold text-white tracking-widest">LIVE</span>
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-0 top-0 bottom-0 z-10 flex items-center px-2 transition-opacity hover:opacity-60 sm:hidden"
          style={{ color: "rgba(255,255,255,0.5)" }}
          aria-label="Dismiss ticker"
        >
          <X className="w-3 h-3" />
        </button>

        {/* Scrolling ticker */}
        <div className="ml-20 mr-6 h-full overflow-hidden">
          <div
            ref={tickerRef}
            className="flex items-center h-full animate-ticker whitespace-nowrap"
          >
            {items.map((quote, i) => {
              const up = quote.changePct >= 0;
              return (
                <button
                  key={`${quote.symbol}-${i}`}
                  onClick={() => setSelected(quote)}
                  className="inline-flex items-center gap-2 px-5 h-full transition-opacity hover:opacity-70 flex-shrink-0"
                >
                  <span
                    className="text-2xs font-mono font-semibold"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    {quote.symbol.replace("C:", "").replace("X:", "")}
                  </span>
                  <span
                    className="text-2xs font-mono"
                    style={{ color: "var(--cream)" }}
                  >
                    {quote.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </span>
                  <span
                    className="text-2xs font-mono"
                    style={{ color: up ? "#ea580c" : "#f87171" }}
                  >
                    {up ? "▲" : "▼"} {Math.abs(quote.changePct).toFixed(2)}%
                  </span>
                  <span
                    className="text-2xs"
                    style={{ color: "rgba(255,255,255,0.15)" }}
                  >
                    ·
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <SlideOver quote={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
