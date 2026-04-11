"use client";

import { useEffect, useState } from "react";

interface Quote {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
}

export default function TickerBar() {
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then((data: Quote[]) => {
        if (Array.isArray(data) && data.length > 0) setQuotes(data);
      })
      .catch(() => {});
  }, []);

  // Use a subset of the most recognisable symbols for the bar
  const PRIORITY = ["SPY", "DAX", "ISF", "EWJ", "FXI", "C:EURUSD", "C:GBPUSD", "C:XAUUSD", "C:WTIUSD", "X:BTCUSD"];
  const ordered = [
    ...PRIORITY.map((s) => quotes.find((q) => q.symbol === s)).filter(Boolean),
    ...quotes.filter((q) => !PRIORITY.includes(q.symbol)),
  ] as Quote[];

  const items = ordered.length > 0 ? [...ordered, ...ordered] : [];

  return (
    <div className="overflow-hidden" style={{ height: "36px", background: "var(--navy)", borderBottom: "1px solid var(--navy-l)" }}>
      <div className="flex items-center h-full">
        {/* Live label */}
        <div
          className="flex-shrink-0 h-full flex items-center px-4 z-10"
          style={{ background: "var(--red)" }}
        >
          <span
            className="text-white font-mono text-2xs tracking-widest uppercase"
            style={{ fontFamily: "var(--font-jetbrains)" }}
          >
            Live
          </span>
        </div>

        {/* Scrolling track */}
        <div className="overflow-hidden flex-1">
          {items.length === 0 ? (
            <div className="flex items-center h-full px-5">
              <span className="text-2xs text-gray-500" style={{ fontFamily: "var(--font-jetbrains)" }}>
                Loading markets…
              </span>
            </div>
          ) : (
            <div className="flex animate-ticker whitespace-nowrap">
              {items.map((item, i) => {
                const up = item.changePct >= 0;
                const sign = up ? "+" : "";
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 px-5"
                    style={{
                      borderRight: "1px solid rgba(255,255,255,0.08)",
                      fontFamily: "var(--font-jetbrains)",
                    }}
                  >
                    <span className="text-2xs text-gray-400 uppercase tracking-wider">
                      {item.symbol.replace("C:", "").replace("X:", "")}
                    </span>
                    <span className="text-2xs text-white font-medium">
                      {item.price < 1
                        ? item.price.toFixed(5)
                        : item.price < 100
                        ? item.price.toFixed(3)
                        : item.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span
                      className="text-2xs font-medium"
                      style={{ color: up ? "#16a34a" : "#f87171" }}
                    >
                      {sign}{item.changePct.toFixed(2)}%
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
