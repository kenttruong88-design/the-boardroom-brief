"use client";

import Link from "next/link";
import { useState } from "react";
import { NAV_LINKS } from "@/app/lib/nav";

const LEGAL_LINKS = [
  { label: "Privacy Policy",      href: "/privacy" },
  { label: "Terms of Service",    href: "/terms" },
  { label: "Cookie Policy",       href: "/cookies" },
  { label: "Editorial Standards", href: "/editorial-standards" },
];

const COMPANY_LINKS = [
  { label: "About",     href: "/about" },
  { label: "Advertise", href: "/advertise" },
  { label: "Careers",   href: "/careers" },
  { label: "Press",     href: "/press" },
  { label: "Contact",   href: "/contact" },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitted">("idle");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email.trim()) setStatus("submitted");
  };

  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy-500 text-cream-100">
      {/* Red rule at top — the publication's signature gravity */}
      <div className="h-1 bg-red-500" />

      {/* ── Main columns ──────────────────────────────────────────── */}
      <div className="site-container py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-16">

          {/* ── Column 1: Branding ──────────────────────────────── */}
          <div className="space-y-5">
            <div>
              <Link href="/" className="no-underline group block">
                <span
                  className="font-headline font-black text-cream-100 tracking-tight leading-none block transition-colors duration-[120ms] group-hover:text-red-400"
                  style={{ fontSize: "clamp(1.25rem, 2.5vw, 1.875rem)" }}
                >
                  The Boardroom Brief
                </span>
              </Link>
              <div className="mt-3 h-px bg-rule-dark" />
            </div>

            <p className="font-body text-base text-cream-200 italic leading-snug">
              Real markets. Real news.<br />
              Questionable corporate poetry.
            </p>

            <p className="font-body text-sm text-cream-400 leading-relaxed max-w-xs">
              The Boardroom Brief is a satirical publication. Any resemblance
              to actual financial advice is purely coincidental and frankly
              alarming.
            </p>

            <p className="font-data text-[11px] text-cream-500 tracking-wide leading-relaxed">
              © {year} The Boardroom Brief. All rights reserved.<br />
              Independent financial news with a corporate twist.
            </p>
          </div>

          {/* ── Column 2: Navigation ────────────────────────────── */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-body text-[10px] font-bold tracking-widest uppercase text-gold-500 mb-5">
                Sections
              </h3>
              <ul className="list-none m-0 p-0 space-y-3">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="
                        font-body text-sm text-cream-300
                        no-underline
                        hover:text-cream-100
                        hover:underline decoration-red-500 underline-offset-2
                        transition-colors duration-[120ms]
                      "
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-body text-[10px] font-bold tracking-widest uppercase text-gold-500 mb-5">
                Company
              </h3>
              <ul className="list-none m-0 p-0 space-y-3">
                {COMPANY_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="
                        font-body text-sm text-cream-300
                        no-underline
                        hover:text-cream-100
                        hover:underline decoration-red-500 underline-offset-2
                        transition-colors duration-[120ms]
                      "
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Column 3: Newsletter ────────────────────────────── */}
          <div>
            <h3 className="font-body text-[10px] font-bold tracking-widest uppercase text-gold-500 mb-2">
              The Brief — Weekly
            </h3>
            <p className="font-body text-sm text-cream-300 mb-6 leading-relaxed">
              Market intelligence and corporate satire, delivered every Monday.
              Unsubscribe whenever your portfolio allows.
            </p>

            {status === "submitted" ? (
              <div className="border border-gold-700 p-4 bg-navy-400">
                <p className="font-data text-sm text-gold-400 tracking-wide">
                  ✓ Subscribed. Our lawyers will be in touch.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-3">
                <div>
                  <label
                    htmlFor="footer-email"
                    className="sr-only"
                  >
                    Email address
                  </label>
                  <input
                    id="footer-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="
                      w-full px-3 py-2.5
                      bg-navy-400 border border-rule-dark
                      text-cream-100 placeholder:text-cream-500
                      font-body text-sm
                      focus:outline-none focus:border-gold-600
                      transition-colors duration-[120ms]
                      rounded-none
                    "
                  />
                </div>
                <button
                  type="submit"
                  className="
                    w-full px-4 py-2.5 cursor-pointer
                    bg-red-500 hover:bg-red-600
                    font-body text-xs font-bold tracking-widest uppercase
                    text-cream-100
                    transition-colors duration-[120ms]
                    border-0
                  "
                >
                  Subscribe — It&apos;s Free
                </button>
                <p className="font-data text-[10px] text-cream-500 tracking-wide">
                  No spam. No AI-generated haiku. Probably.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────────── */}
      <div className="border-t border-rule-dark">
        <div className="site-container py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-5 gap-y-1 list-none m-0 p-0">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="
                      font-data text-[10px] text-cream-500 tracking-wide
                      no-underline hover:text-cream-300
                      transition-colors duration-[120ms]
                    "
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="font-data text-[10px] text-cream-500 tracking-wide whitespace-nowrap">
            Not financial advice. Not even close.
          </p>
        </div>
      </div>
    </footer>
  );
}
