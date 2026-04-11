"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Menu, X, Search, Sun, Moon } from "lucide-react";
import { PILLARS, MOCK_ARTICLES } from "@/app/lib/mock-data";
import LoginModal from "@/app/components/auth/LoginModal";

export default function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [searchOpen]);

  const searchResults = searchQuery.trim().length > 1
    ? MOCK_ARTICLES.filter((a) =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <header style={{ background: "var(--cream)", borderBottom: "2px solid var(--navy)" }}>
      {/* Masthead */}
      <div className="container-editorial py-4 border-b relative" style={{ borderColor: "var(--border)" }}>
        {/* Date — top-right corner, above the title */}
        <div className="absolute top-3 right-0 hidden sm:block">
          <span className="eyebrow-muted text-2xs" style={{ fontFamily: "var(--font-jetbrains)" }} suppressHydrationWarning>
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>

        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1
              className="text-4xl sm:text-5xl font-serif font-bold tracking-tight"
              style={{ color: "var(--navy)" }}
            >
              The Alignment Times
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
              onClick={() => setSearchOpen(true)}
              className="transition-colors"
              style={{ color: "var(--ink-m)" }}
              aria-label="Search"
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
            <button
              onClick={() => setLoginOpen(true)}
              className="text-sm font-sans transition-colors"
              style={{ color: "var(--ink-m)" }}
            >
              Sign in
            </button>
            <Link href="/subscribe" className="btn-red">
              Subscribe
            </Link>
          </div>

          {/* Mobile controls */}
          <div className="lg:hidden flex items-center gap-3 ml-auto">
            <button onClick={() => setSearchOpen(true)} style={{ color: "var(--ink-m)" }} aria-label="Search">
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
              5 Continents
            </Link>
            <div className="pt-3">
              <button onClick={() => { setLoginOpen(true); setMobileOpen(false); }} className="btn-navy block text-center mb-2 w-full">
                Sign in
              </button>
              <Link href="/subscribe" className="btn-red block text-center">
                Subscribe
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />

      {/* Search Overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "rgba(15,23,42,0.85)" }}
          onClick={(e) => e.target === e.currentTarget && setSearchOpen(false)}
        >
          <div style={{ background: "var(--cream)", borderBottom: "1px solid var(--border)" }}>
            <div className="container-editorial py-4 flex items-center gap-3">
              <Search className="w-5 h-5 flex-shrink-0" style={{ color: "var(--ink-m)" }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles…"
                className="flex-1 text-base font-sans outline-none bg-transparent"
                style={{ color: "var(--ink)" }}
                onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
              />
              <button onClick={() => setSearchOpen(false)} style={{ color: "var(--ink-m)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="container-editorial pb-4 space-y-0">
                {searchResults.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/${article.pillar}/${article.slug}`}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-start gap-3 py-3 border-t transition-colors hover:opacity-70"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="flex-1">
                      <p className="eyebrow mb-0.5">{article.pillar?.replace(/-/g, " ")}</p>
                      <p className="text-sm font-sans font-medium" style={{ color: "var(--ink)" }}>{article.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {searchQuery.trim().length > 1 && searchResults.length === 0 && (
              <div className="container-editorial pb-4 pt-2">
                <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>No results for "{searchQuery}"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
