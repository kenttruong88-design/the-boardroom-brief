import type { ReactNode } from "react";
import Link from "next/link";

export type SidebarSection = {
  id: string;
  label: string;
};

type EditorialPageProps = {
  eyebrow: string;
  headline: string;
  lastUpdated?: string;
  /** Pass sections to render the prose+sidebar two-column layout */
  sections?: SidebarSection[];
  children: ReactNode;
};

/**
 * Shared layout for editorial-style content pages (legal, about, contact).
 *
 * With sections: renders a 720px prose column + sticky sidebar nav on desktop.
 * Without sections: renders children directly in site-container (full page control).
 */
export default function EditorialPage({
  eyebrow,
  headline,
  lastUpdated,
  sections,
  children,
}: EditorialPageProps) {
  const hasSidebar = sections && sections.length > 0;

  return (
    <div className="bg-cream-100 dark:bg-navy-500 min-h-screen">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="border-b-4 border-navy-500 dark:border-cream-200">
        <div className="site-container py-10 md:py-14">
          <p className="label mb-3">{eyebrow}</p>
          <h1
            className="font-headline font-black text-navy-500 dark:text-cream-100 leading-tight tracking-tight mb-4 text-balance"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
          >
            {headline}
          </h1>
          {lastUpdated && (
            <p className="font-data text-xs text-ink-faint dark:text-cream-400 tracking-wide">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────── */}
      <div className="site-container py-12 md:py-16">
        {hasSidebar ? (
          <div className="flex gap-12 lg:gap-16 items-start">
            {/* Prose column — max 720px */}
            <div className="flex-1 min-w-0 max-w-[720px]">
              {children}
            </div>

            {/* Sidebar — desktop only */}
            <aside className="hidden lg:block w-52 shrink-0">
              <div className="sticky top-28">
                <p className="font-body text-[10px] font-bold tracking-widest uppercase text-gold-500 mb-4">
                  On this page
                </p>
                <nav aria-label="Page sections">
                  <ul className="list-none m-0 p-0 space-y-1">
                    {sections.map((section) => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          className="
                            font-body text-sm text-ink-muted dark:text-cream-400
                            no-underline hover:text-navy-500 dark:hover:text-cream-100
                            transition-colors duration-[120ms] block py-1
                            border-l-2 border-transparent hover:border-red-500
                            pl-3 -ml-3
                          "
                        >
                          {section.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>

                <div className="mt-8 pt-6 border-t border-rule dark:border-rule-dark">
                  <Link
                    href="/contact"
                    className="
                      font-body text-xs font-semibold tracking-widest uppercase
                      text-ink-muted dark:text-cream-400
                      no-underline hover:text-red-500 dark:hover:text-red-400
                      transition-colors duration-[120ms]
                    "
                  >
                    Questions? Contact us →
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
