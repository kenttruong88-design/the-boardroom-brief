"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="container-editorial py-32 text-center">
        <p className="eyebrow mb-4" style={{ color: "var(--red)" }}>Something went wrong</p>
        <h1 className="text-3xl font-serif font-bold mb-4" style={{ color: "var(--navy)" }}>
          The markets are temporarily unavailable.
        </h1>
        <p className="font-sans text-sm mb-8" style={{ color: "var(--ink-m)" }}>
          Our correspondents are investigating. Try again or return to the homepage.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-red">Try again</button>
          <Link href="/" className="btn-outline" style={{ border: "1px solid var(--border)", color: "var(--navy)" }}>
            Go home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs" style={{ color: "var(--ink-m)", fontFamily: "var(--font-jetbrains)" }}>
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
