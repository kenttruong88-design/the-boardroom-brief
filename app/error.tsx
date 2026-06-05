"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-headline), Georgia, serif",
          fontSize: "2rem",
          marginBottom: "1rem",
        }}
      >
        Something went wrong
      </h1>
      <p
        style={{
          color: "var(--color-text-secondary)",
          margin: "0 0 1.5rem",
          maxWidth: "400px",
          lineHeight: 1.6,
        }}
      >
        Our engineers have been notified. In the meantime, please try refreshing
        the page.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "0.6rem 1.4rem",
          border: "1px solid currentColor",
          borderRadius: "4px",
          cursor: "pointer",
          background: "transparent",
        }}
      >
        Try again
      </button>
      {error.digest && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-tertiary)",
            marginTop: "2rem",
            opacity: 0.6,
          }}
        >
          Error reference: {error.digest}
        </p>
      )}
    </div>
  );
}
