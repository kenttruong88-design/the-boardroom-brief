import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
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
      <p
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: "0.8rem",
          letterSpacing: "0.1em",
          opacity: 0.5,
          marginBottom: "1rem",
          textTransform: "uppercase",
        }}
      >
        404
      </p>
      <h1
        style={{
          fontFamily: "var(--font-headline), Georgia, serif",
          fontSize: "2rem",
          marginBottom: "1rem",
        }}
      >
        Page not found
      </h1>
      <p
        style={{
          color: "var(--color-text-secondary)",
          margin: "0 0 2rem",
          maxWidth: "360px",
          lineHeight: 1.6,
        }}
      >
        The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
      </p>
      <Link
        href="/"
        style={{
          padding: "0.6rem 1.4rem",
          background: "#0f1923",
          color: "#fff",
          textDecoration: "none",
          borderRadius: "4px",
          fontSize: "0.875rem",
        }}
      >
        Back to homepage
      </Link>
    </div>
  );
}
