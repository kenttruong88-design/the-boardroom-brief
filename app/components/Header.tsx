"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Sun, Moon, Search } from "lucide-react";
import { NAV_LINKS } from "@/app/lib/nav";
import { useTheme } from "@/app/components/ThemeProvider";
import SearchOverlay from "@/app/components/SearchOverlay";

export default function Header() {
  const { darkMode, toggleDark } = useTheme();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K opens search from anywhere on the page
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className={`bg-cream-100 dark:bg-navy-500 sticky top-0 z-40${isHome ? " border-b-2 border-navy-500 dark:border-cream-200" : ""}`}>
      {/* ── Masthead ───────────────────────────────────────────────── */}
      <div className="site-container">
        <div className="flex items-center justify-between py-8 border-b border-rule dark:border-rule-dark">

          {/* Left: date */}
          <span
            className="hidden sm:block font-data text-[11px] tracking-wide text-ink-faint dark:text-cream-500"
            suppressHydrationWarning
          >
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day:     "numeric",
              month:   "long",
              year:    "numeric",
            })}
          </span>

          {/* Centre: wordmark */}
          <Link href="/" className="no-underline">
            <span
              className="font-headline font-black text-navy-500 dark:text-cream-100 tracking-tight leading-none block hover:text-red-500 dark:hover:text-red-400 transition-colors duration-[120ms]"
              style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}
            >
              The Alignment Times
            </span>
          </Link>

          {/* Right: actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1 text-ink-muted dark:text-cream-300 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-[120ms]"
              aria-label="Search (⌘K)"
              title="Search (⌘K)"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={toggleDark}
              className="p-1 text-ink-muted dark:text-cream-300 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-[120ms]"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              href="/subscribe"
              className="inline-flex items-center font-body text-xs font-bold tracking-widest uppercase px-3 py-1.5 bg-red-500 text-cream-100 no-underline hover:bg-navy-500 dark:hover:bg-cream-200 dark:hover:text-navy-500 transition-colors duration-[120ms]"
            >
              Subscribe
            </Link>
            <button
              className="sm:hidden p-1 text-navy-500 dark:text-cream-100"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Open menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ── Section nav ────────────────────────────────────────── */}
        <nav className="hidden sm:flex items-center gap-0 py-1.5" aria-label="Sections">
          {NAV_LINKS.map((link, i) => (
            <span key={link.href} className="flex items-center">
              <Link
                href={link.href}
                className="
                  px-3 py-1 font-body text-sm text-ink-muted dark:text-cream-300
                  no-underline hover:text-red-500 dark:hover:text-red-400
                  transition-colors duration-[120ms]
                "
              >
                {link.label}
              </Link>
              {i < NAV_LINKS.length - 1 && (
                <span className="text-rule dark:text-rule-dark select-none">|</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* ── Mobile menu ───────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-rule dark:border-rule-dark bg-cream-100 dark:bg-navy-500">
          <div className="site-container py-4 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="
                  block px-2 py-2.5 font-body text-sm text-navy-500 dark:text-cream-100
                  no-underline border-b border-rule dark:border-rule-dark
                  hover:text-red-500 dark:hover:text-red-400
                  transition-colors duration-[120ms]
                "
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3">
              <Link
                href="/subscribe"
                onClick={() => setMobileOpen(false)}
                className="flex-1 text-center font-body text-xs font-bold tracking-widest uppercase py-2.5 bg-red-500 text-cream-100 no-underline hover:bg-navy-500 transition-colors duration-[120ms]"
              >
                Subscribe
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Search overlay ────────────────────────────────────────── */}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
