"use client";

import { useEffect, useRef } from "react";

interface AdUnitProps {
  /** AdSense ad-slot ID for this placement (from your AdSense dashboard) */
  adSlot: string;
  /** Visual size hint -- controls max-width and min-height of the container */
  slot: "leaderboard" | "sidebar" | "inline" | "sponsorship";
  label?: string;
  className?: string;
}

const dimensions: Record<AdUnitProps["slot"], { maxWidth: number; minHeight: number }> = {
  leaderboard:  { maxWidth: 728, minHeight: 90 },
  sidebar:      { maxWidth: 300, minHeight: 250 },
  inline:       { maxWidth: 600, minHeight: 90 },
  sponsorship:  { maxWidth: 600, minHeight: 120 },
};

const CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export default function AdUnit({ adSlot, slot, label = "Advertisement", className = "" }: AdUnitProps) {
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const { maxWidth, minHeight } = dimensions[slot];

  useEffect(() => {
    if (!CLIENT_ID || pushed.current) return;
    try {
      pushed.current = true;
      // @ts-expect-error adsbygoogle is injected by the AdSense script
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded yet -- silent fail
    }
  }, []);

  // No client ID = show labelled placeholder (pre-approval / local dev)
  if (!CLIENT_ID) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{
          width: "100%",
          maxWidth,
          minHeight,
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          margin: "0 auto",
        }}
        aria-hidden="true"
      >
        <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ width: "100%", maxWidth, margin: "0 auto", overflow: "hidden" }}
    >
      <p className="text-2xs font-sans text-center mb-1" style={{ color: "var(--ink-m)" }}>
        {label}
      </p>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", minHeight }}
        data-ad-client={CLIENT_ID}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
