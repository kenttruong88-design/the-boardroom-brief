import { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import SearchResults from "./SearchResults";

interface Props {
  searchParams: Promise<{ q?: string; pillar?: string; page?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `"${q}" — The Alignment Times` : "Search — The Alignment Times",
    description: q
      ? `Search results for "${q}" on The Alignment Times`
      : "Search The Alignment Times for business analysis, market commentary, and satire.",
    robots: { index: false },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = "", pillar = "", page = "0" } = await searchParams;

  return (
    <main className="min-h-screen" style={{ background: "var(--cream)" }}>
      <div className="site-container py-10">

        {/* Header */}
        <div className="mb-8 border-b-2 border-navy-500 dark:border-cream-200 pb-6">
          <h1 className="font-headline font-black text-navy-500 dark:text-cream-100 text-2xl sm:text-3xl mb-4">
            Search
          </h1>
          <SearchForm initialQuery={q} initialPillar={pillar} />
        </div>

        {/* Results */}
        {q ? (
          <SearchResults query={q} pillar={pillar} page={parseInt(page, 10)} />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-10 h-10 text-ink-faint dark:text-cream-500 mb-4" />
            <p className="font-body text-ink-muted dark:text-cream-300">
              Enter a search term to find articles
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

// ── Inline form (server component — progressive enhancement) ─────────────────

const PILLARS = [
  { slug: "",               label: "All sections" },
  { slug: "markets-floor",  label: "Markets Floor" },
  { slug: "macro-mondays",  label: "Macro Mondays" },
  { slug: "c-suite-circus", label: "C-Suite Circus" },
  { slug: "global-office",  label: "Global Office" },
  { slug: "water-cooler",   label: "Water Cooler" },
  { slug: "off-the-record", label: "Off the Record" },
];

function SearchForm({ initialQuery, initialPillar }: { initialQuery: string; initialPillar: string }) {
  return (
    <form method="GET" action="/search" className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1 flex items-center gap-2 border-2 border-navy-500 dark:border-cream-200 px-3 py-2">
        <Search className="w-4 h-4 shrink-0 text-ink-muted dark:text-cream-300" />
        <input
          type="search"
          name="q"
          defaultValue={initialQuery}
          placeholder="Search articles…"
          autoFocus
          className="flex-1 font-body text-sm bg-transparent text-ink dark:text-cream-100 placeholder:text-ink-faint dark:placeholder:text-cream-500 outline-none"
        />
      </div>
      <select
        name="pillar"
        defaultValue={initialPillar}
        className="font-body text-sm border-2 border-navy-500 dark:border-cream-200 bg-cream-100 dark:bg-navy-500 text-ink dark:text-cream-100 px-3 py-2 outline-none"
      >
        {PILLARS.map((p) => (
          <option key={p.slug} value={p.slug}>{p.label}</option>
        ))}
      </select>
      <button
        type="submit"
        className="font-body text-sm font-bold tracking-widest uppercase px-5 py-2 bg-red-500 text-cream-100 hover:bg-navy-500 transition-colors duration-[120ms]"
      >
        Search
      </button>
    </form>
  );
}
