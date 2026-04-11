"use client";

import { TICKER_DATA } from "@/app/lib/mock-data";

export default function TickerBar() {
  const items = [...TICKER_DATA, ...TICKER_DATA];

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
          <div className="flex animate-ticker whitespace-nowrap">
            {items.map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 px-5"
                style={{
                  borderRight: "1px solid rgba(255,255,255,0.08)",
                  fontFamily: "var(--font-jetbrains)",
                }}
              >
                <span className="text-2xs text-gray-400 uppercase tracking-wider">
                  {item.symbol}
                </span>
                <span className="text-2xs text-white font-medium">{item.value}</span>
                <span
                  className="text-2xs font-medium"
                  style={{ color: item.up ? "#ea580c" : "#f87171" }}
                >
                  {item.change}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
