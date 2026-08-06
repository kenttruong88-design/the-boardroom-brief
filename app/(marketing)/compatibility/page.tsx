import { Metadata } from "next";
import Link from "next/link";
import { getScoredCountries } from "@/app/lib/compatibility";
import { flagEmoji } from "@/app/lib/country-flags";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Compatibility Index — The Alignment Times",
  description:
    "Pick a country. We'll tell you who it's culturally compatible with — and who it's headed for a slow-motion office-culture collision with.",
};

export default async function CompatibilityIndexPage() {
  const countries = await getScoredCountries();

  return (
    <div style={{ background: "var(--cream)" }}>
      <div style={{ background: "var(--navy)", borderBottom: "3px solid var(--red)" }}>
        <div className="container-editorial py-8">
          <span className="eyebrow-gold text-2xs" style={{ color: "var(--gold)" }}>
            An Entirely Unscientific Instrument
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold mt-2" style={{ color: "var(--cream)" }}>
            The Compatibility Index
          </h1>
          <p className="text-sm font-sans mt-3 max-w-2xl" style={{ color: "rgba(245,240,232,0.75)" }}>
            Pick a country. We&apos;ll rank everyone we&apos;ve compared it against, from
            genuinely aligned to actively hostile to each other&apos;s meeting culture.
            Scored by reading our own reporting, not by licensing someone else&apos;s
            proprietary survey — so treat it the way you&apos;d treat a restaurant critic,
            not a scientific instrument.
          </p>
        </div>
      </div>

      <div className="container-editorial py-10">
        {countries.length === 0 ? (
          <p className="text-sm font-sans italic" style={{ color: "var(--ink-m)" }}>
            No compatibility scores yet — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {countries.map((c) => (
              <Link
                key={c.slug}
                href={`/compatibility/${c.slug}`}
                className="hover-card flex items-center gap-2 px-3 py-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <span className="text-2xl leading-none">{flagEmoji(c.slug)}</span>
                <span className="text-sm font-sans font-semibold" style={{ color: "var(--navy)" }}>
                  {c.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
