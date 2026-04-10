"use client";

interface AdUnitProps {
  slot: "leaderboard" | "sidebar" | "inline" | "sponsorship";
  label?: string;
  className?: string;
}

const dimensions: Record<AdUnitProps["slot"], { width: number; height: number }> = {
  leaderboard:  { width: 728, height: 90 },
  sidebar:      { width: 300, height: 250 },
  inline:       { width: 468, height: 60 },
  sponsorship:  { width: 600, height: 120 },
};

export default function AdUnit({ slot, label = "Advertisement", className = "" }: AdUnitProps) {
  // In production, replace this placeholder with your ad network embed
  const { width, height } = dimensions[slot];

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{
        width: "100%",
        maxWidth: width,
        height,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        margin: "0 auto",
      }}
      aria-label={label}
      role="complementary"
    >
      <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>
        {label}
      </span>
    </div>
  );
}
