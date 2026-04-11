import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import PostHogProvider from "./components/PostHogProvider";

// Fraunces: optical-size serif — distinctive, nothing like FT's Playfair
const fraunces = Fraunces({
  variable: "--font-playfair",   // keep CSS var name so all components work unchanged
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

// Plus Jakarta Sans: modern geometric sans
const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-dm-sans",    // keep CSS var name so all components work unchanged
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealignmenttimes.com";

export const metadata: Metadata = {
  title: {
    default: "The Alignment Times",
    template: "%s | The Alignment Times",
  },
  description: "Economic intelligence across five continents. Markets, policy, and power — aligned.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: SITE_URL },
  openGraph: {
    siteName: "The Alignment Times",
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "The Alignment Times",
  "url": SITE_URL,
  "description": "Economic intelligence across five continents.",
  "logo": { "@type": "ImageObject", "url": `${SITE_URL}/logo.png` },
  "sameAs": [],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        {/* Plausible Analytics — GDPR compliant, no cookie banner needed */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.tagged-events.js"
          />
        )}
      </head>
      <body className={`${fraunces.variable} ${jakartaSans.variable} ${jetbrainsMono.variable} antialiased`}>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
