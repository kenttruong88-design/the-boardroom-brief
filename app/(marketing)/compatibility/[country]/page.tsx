import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ExternalLink } from "lucide-react";
import { getCompatibilityForCountry, getScoredCountries } from "@/app/lib/compatibility";
import { flagIconPath } from "@/app/lib/country-flags";

export const revalidate = 3600;

interface Props {
  params: Promise<{ country: string }>;
}

export async function generateStaticParams() {
  const countries = await getScoredCountries();
  return countries.map((c) => ({ country: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const countries = await getScoredCountries();
  const name = countries.find((c) => c.slug === country)?.name ?? countryNameFromSlug(country);
  return {
    title: `${name} Compatibility Index — The Alignment Times`,
    description: `Who is ${name} culturally compatible with at work? Ranked, scored, and cited.`,
  };
}

// We only store the *other* country's name on each row — this country's own
// display name comes from getScoredCountries() instead; title-casing the
// slug here is just a reasonable fallback if that lookup ever misses.
function countryNameFromSlug(slug: string): string {
  return slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

function scoreColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 45) return "#b8960c";
  return "#c8391a";
}

const SECTION_LABEL: Record<string, string> = {
  "global-office": "Global Office",
  "out-of-office": "Out of Office",
};

export default async function CountryCompatibilityPage({ params }: Props) {
  const { country } = await params;
  const [matches, allCountries] = await Promise.all([
    getCompatibilityForCountry(country),
    getScoredCountries(),
  ]);
  if (matches.length === 0) notFound();

  const self = allCountries.find((c) => c.slug === country);
  const name = self?.name ?? countryNameFromSlug(country);

  return (
    <div style={{ background: "var(--cream)" }}>
      <div style={{ background: "var(--navy)", borderBottom: "3px solid var(--red)" }}>
        <div className="container-editorial py-8">
          <Link
            href="/compatibility"
            className="text-2xs"
            style={{
              color: "rgba(245,240,232,0.6)", fontFamily: "var(--font-jetbrains)",
              textTransform: "uppercase", letterSpacing: "0.07em",
            }}
          >
            ← Compatibility Index
          </Link>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold mt-2 flex items-center gap-3" style={{ color: "var(--cream)" }}>
            {flagIconPath(country) && (
              // eslint-disable-next-line @next/next/no-img-element -- small static SVG from /public, next/image is overkill
              <img src={flagIconPath(country)!} alt="" width={40} height={30} />
            )}
            {name}
          </h1>
          <p className="text-sm font-sans mt-2" style={{ color: "rgba(245,240,232,0.75)" }}>
            Ranked against every country we&apos;ve compared {name} to, highest compatibility first.
          </p>
        </div>
      </div>

      <div className="container-editorial py-10 space-y-3">
        {matches.map((m) => (
          <div key={m.otherSlug} style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-4 px-5 py-4">
              {flagIconPath(m.otherSlug) && (
                // eslint-disable-next-line @next/next/no-img-element -- small static SVG from /public, next/image is overkill
                <img src={flagIconPath(m.otherSlug)!} alt="" width={32} height={24} style={{ flexShrink: 0 }} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <Link
                    href={`/compatibility/${m.otherSlug}`}
                    className="font-serif font-bold text-base hover:opacity-75"
                    style={{ color: "var(--navy)" }}
                  >
                    {m.otherName}
                  </Link>
                  <span
                    className="text-2xs"
                    style={{
                      fontFamily: "var(--font-jetbrains)", fontWeight: 700,
                      color: scoreColor(m.overallScore),
                    }}
                  >
                    {m.overallScore}/100
                  </span>
                </div>
                <p className="text-sm font-sans italic mt-1" style={{ color: "var(--ink-m)" }}>
                  &ldquo;{m.verdict}&rdquo;
                </p>
              </div>
            </div>

            <details>
              <summary
                className="flex items-center gap-1.5 px-5 pb-3 cursor-pointer select-none"
                style={{
                  fontFamily: "var(--font-jetbrains)", fontSize: "0.6rem",
                  textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-m)",
                }}
              >
                <ChevronDown className="w-3 h-3" />
                Breakdown &amp; sources
              </summary>
              <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {m.dimensions.map((d) => (
                    <div key={d.label} style={{ background: "var(--cream)", padding: "10px 12px" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-2xs font-semibold" style={{ color: "var(--navy)" }}>{d.label}</span>
                        <span
                          className="text-2xs"
                          style={{ fontFamily: "var(--font-jetbrains)", fontWeight: 700, color: scoreColor(d.score) }}
                        >
                          {d.score}
                        </span>
                      </div>
                      <p className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>{d.blurb}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.sourceArticles.map((a) => (
                    <a
                      key={a.slug}
                      href={`/${a.section}/${a.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover-card px-2 py-1"
                      style={{
                        fontFamily: "var(--font-jetbrains)", fontSize: "0.6rem",
                        color: "var(--ink-m)", border: "1px solid var(--border)",
                      }}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      {SECTION_LABEL[a.section] ?? a.section}: {a.title}
                    </a>
                  ))}
                </div>
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
