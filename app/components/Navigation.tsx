"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Search, Sun, Moon } from "lucide-react";
import { PILLARS } from "@/app/lib/mock-data";

export default function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <header style={{ background: "var(--cream)", borderBottom: "2px solid var(--navy)" }}>
      {/* Masthead */}
      <div className="container-editorial py-4 border-b relative" style={{ borderColor: "var(--border)" }}>
        {/* Date — top-right corner, above the title */}
        <div className="absolute top-3 right-0 hidden sm:block">
          <span className="eyebrow-muted text-2xs" style={{ fontFamily: "var(--font-jetbrains)" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>

        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1
              className="text-4xl sm:text-5xl font-serif font-bold tracking-tight"
              style={{ color: "var(--navy)" }}
            >
              The Boardroom Brief
            </h1>
          </Link>
          <p className="eyebrow-muted mt-1">
            Real markets. Real news. Questionable corporate poetry.
          </p>
        </div>
      </div>

      {/* Nav bar */}
      <div className="container-editorial">
        <div className="flex items-center justify-between py-2">
          {/* Desktop section nav */}
          <nav className="hidden lg:flex items-center gap-0">
            {PILLARS.map((pillar, i) => (
              <span key={pillar.slug} className="flex items-center">
                <Link
                  href={`/${pillar.slug}`}
                  className="px-3 py-1.5 text-sm font-sans font-medium transition-colors hover:text-red-accent"
                  style={{ color: "var(--ink-m)" }}
                >
                  {pillar.name}
                </Link>
                {i < PILLARS.length - 1 && (
                  <span className="text-cream-border select-none">|</span>
                )}
              </span>
            ))}
          </nav>

          {/* Right actions */}
          <div className="hidden lg:flex items-center gap-4">
            <button
              className="text-ink-muted hover:text-navy transition-colors"
              style={{ color: "var(--ink-m)" }}
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="transition-colors"
              style={{ color: "var(--ink-m)" }}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              href="/login"
              className="text-sm font-sans transition-colors"
              style={{ color: "var(--ink-m)" }}
            >
              Sign in
            </Link>
            <Link href="/subscribe" className="btn-red">
              Subscribe
            </Link>
          </div>

          {/* Mobile controls */}
          <div className="lg:hidden flex items-center gap-3 ml-auto">
            <button style={{ color: "var(--ink-m)" }}>
              <Search className="w-4 h-4" />
            </button>
            <Link href="/subscribe" className="btn-red text-xs px-3 py-1.5">
              Subscribe
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{ color: "var(--ink)" }}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="lg:hidden border-t"
          style={{ borderColor: "var(--border)", background: "var(--cream)" }}
        >
          <div className="container-editorial py-4 space-y-1">
            {PILLARS.map((pillar) => (
              <Link
                key={pillar.slug}
                href={`/${pillar.slug}`}
                className="block px-3 py-2.5 text-sm font-sans font-medium border-b transition-colors hover:text-red-accent"
                style={{ borderColor: "var(--border)", color: "var(--ink)" }}
                onClick={() => setMobileOpen(false)}
              >
                {pillar.name}
              </Link>
            ))}
            <Link
              href="/economies"
              className="block px-3 py-2.5 text-sm font-sans border-b transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--ink-m)" }}
              onClick={() => setMobileOpen(false)}
            >
              30 Economies
            </Link>
            <div className="pt-3">
              <Link href="/login" className="btn-navy block text-center mb-2">
                Sign in
              </Link>
              <Link href="/subscribe" className="btn-red block text-center">
                Subscribe
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
