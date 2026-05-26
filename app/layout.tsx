import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, JetBrains_Mono, Crimson_Pro } from "next/font/google";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import { AuthProvider } from "@/app/components/auth/AuthProvider";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import PlausibleScript from "@/app/components/analytics/PlausibleScript";
import PostHogProvider from "@/app/components/analytics/PostHogProvider";

// ─── Lazy-loaded client components ───────────────────────────────────────────
// These are deferred so they don't block the initial HTML/CSS paint.
// TickerBar is the heaviest client bundle (~400 LOC + chart SVG logic).
// LoginModal is conditionally visible and never needed on first paint.

const TickerBar = dynamic(() => import("@/app/components/TickerBar"), {
  ssr: false,          // market data is always live; SSR adds no value
  loading: () => (
    <div
      className="h-10 bg-navy-500 dark:bg-navy-600 border-b border-navy-400 dark:border-navy-500"
      aria-hidden="true"
    />
  ),
})

const LoginModal = dynamic(
  () => import("@/app/components/auth/LoginModal"),
  { ssr: false }       // auth modal is never needed server-side
)

// ─── Google Fonts ─────────────────────────────────────────────────────────────

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
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-data",
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,       // data/mono font — below the fold, no need to block
});

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-prose",
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,       // editorial/legal prose only — not on every page
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default: "The Boardroom Brief",
    template: "%s — The Boardroom Brief",
  },
  description:
    "Financial intelligence for the discerning executive. Satire for everyone else.",
  metadataBase: new URL("https://boardroombrief.com"),
};

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: ThemeProvider adds/removes the `dark` class
    // client-side, which differs from the SSR'd HTML. Suppressing avoids the
    // mismatch warning without hiding genuine bugs.
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
            <AuthProvider>
              {/* LoginModal — lazy, only needed when user opens it */}
              <Suspense fallback={null}>
                <LoginModal />
              </Suspense>

              <div className="min-h-screen flex flex-col">
                <Header />

                {/* TickerBar — lazy + ssr:false; market data is always live */}
                <Suspense
                  fallback={
                    <div
                      className="h-10 bg-navy-500 dark:bg-navy-600 border-b border-navy-400 dark:border-navy-500"
                      aria-hidden="true"
                    />
                  }
                >
                  <TickerBar />
                </Suspense>

                <main className="flex-1">
                  {children}
                </main>

                <Footer />
              </div>
            </AuthProvider>
          </ThemeProvider>
        </PostHogProvider>

        {/* Vercel Web Analytics + Speed Insights — zero-config, edge-injected */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
