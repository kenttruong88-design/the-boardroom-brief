import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, JetBrains_Mono, Crimson_Pro } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import PlausibleScript from "@/app/components/analytics/PlausibleScript";
import PostHogProvider from "@/app/components/analytics/PostHogProvider";
import { LazyTickerBar } from "@/app/components/ClientShell";
import CookieBanner from "@/app/components/CookieBanner";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";

// --- Google Fonts ---

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
  preload: true,
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  style: ["normal"],
  display: "swap",
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-data",
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
});

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-prose",
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

// --- Metadata ---

export const metadata: Metadata = {
  title: {
    default: "The Alignment Times",
    template: "%s -- The Alignment Times",
  },
  description:
    "Financial intelligence for the discerning executive. Satire for everyone else.",
  metadataBase: new URL("https://alignmenttimes.com"),
};

// --- Layout ---

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${crimsonPro.variable}`}
      suppressHydrationWarning
    >
      <head>
        <PlausibleScript />
      </head>
      <body className="antialiased">
        <PostHogProvider>
          <ThemeProvider>
              <div className="min-h-screen flex flex-col">
                {/* TickerBar -- above the masthead, client-only */}
                <ErrorBoundary name="ticker-bar">
                  <LazyTickerBar />
                </ErrorBoundary>

                <ErrorBoundary name="header">
                  <Header />
                </ErrorBoundary>

                <main className="flex-1">
                  <ErrorBoundary name="main-content">
                    {children}
                  </ErrorBoundary>
                </main>

                <ErrorBoundary name="footer">
                  <Footer />
                </ErrorBoundary>
              </div>
          </ThemeProvider>
        </PostHogProvider>

        <CookieBanner />

        {/* Vercel Web Analytics + Speed Insights -- zero-config, edge-injected */}
        <Analytics />
        <SpeedInsights />

        {/* Google AdSense -- only injected once client ID is configured */}
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
