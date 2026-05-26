import type { Metadata } from "next";
import Link from "next/link";
import EditorialPage from "@/app/components/editorial-page/EditorialPage";

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@alignmenttimes.com";

export const metadata: Metadata = {
  title: "About | The Alignment Times — Financial News With a Corporate Twist",
  description:
    "The Alignment Times is an independent financial publication covering markets, macroeconomics, and corporate culture across the world's 30 largest economies.",
  openGraph: {
    title: "About | The Alignment Times",
    description:
      "Independent financial news covering markets, macroeconomics, and corporate culture across the world's 30 largest economies.",
    type: "website",
  },
};

const PILLARS = [
  {
    href: "/markets-floor",
    icon: "📈",
    name: "Markets Floor",
    description:
      "Live and daily coverage of equity markets, commodities, currencies, and fixed income across every major exchange. Data-driven. Occasionally alarming.",
  },
  {
    href: "/macro-mondays",
    icon: "🌍",
    name: "Macro Mondays",
    description:
      "Deep dives into the macroeconomic forces shaping the global economy. GDP, inflation, central bank policy, and the slow-motion dramas of fiscal reality.",
  },
  {
    href: "/c-suite-circus",
    icon: "🎪",
    name: "C-Suite Circus",
    description:
      "Corporate affairs coverage with a sharp editorial eye. Earnings calls, leadership moves, M&A, and the management decisions that make you wonder who approved this.",
  },
  {
    href: "/global-office",
    icon: "🌐",
    name: "Global Office",
    description:
      "The world of work, seen from 30 economies. Labour markets, remote work debates, HR policy, and workplace culture filed from the professionals living it.",
  },
  {
    href: "/water-cooler",
    icon: "💧",
    name: "Water Cooler",
    description:
      "Where satire meets the spreadsheet. The Alignment Times's culture desk covers business news with the wit of people who have survived one too many town halls.",
  },
];

const TEAM = [
  {
    emoji: "📊",
    name: "Rex Volkov",
    title: "Senior Markets Correspondent",
    bio: "Rex has covered equity markets through three crashes and one inexplicable meme stock rally. He believes in rigorous data, efficient markets theory, and the restorative power of a cold shower after a Fed press conference.",
  },
  {
    emoji: "🌍",
    name: "Ingrid Holt",
    title: "Macroeconomics Editor",
    bio: "Ingrid has an economist's precision and a diplomat's patience for explaining why inflation is always more complicated than it looks. She covers the global macroeconomic picture from GDP to geopolitics.",
  },
  {
    emoji: "💼",
    name: "Miles Bancroft",
    title: "Corporate Affairs Correspondent",
    bio: "Miles has read more earnings transcripts than any reasonable person should. He specialises in the gap between what executives say on calls and what the numbers actually mean.",
  },
  {
    emoji: "🌺",
    name: "Priya Mehta",
    title: "Global Workplace Correspondent",
    bio: "Priya covers the changing world of work from 30 different vantage points. Labour markets, return-to-office mandates, and the quiet negotiations that happen far from the boardroom.",
  },
  {
    emoji: "🎭",
    name: "Danny Fisk",
    title: "Culture Desk",
    bio: "Danny is the editorial voice that sits between news and satire. He covers corporate culture, business media, and the moments when the financial world forgets to take itself too seriously.",
  },
];

// Top 30 economies by GDP with flag emojis
const ECONOMIES = [
  { name: "United States",    flag: "🇺🇸" },
  { name: "China",            flag: "🇨🇳" },
  { name: "Germany",          flag: "🇩🇪" },
  { name: "Japan",            flag: "🇯🇵" },
  { name: "India",            flag: "🇮🇳" },
  { name: "United Kingdom",   flag: "🇬🇧" },
  { name: "France",           flag: "🇫🇷" },
  { name: "Brazil",           flag: "🇧🇷" },
  { name: "Italy",            flag: "🇮🇹" },
  { name: "Canada",           flag: "🇨🇦" },
  { name: "Russia",           flag: "🇷🇺" },
  { name: "South Korea",      flag: "🇰🇷" },
  { name: "Australia",        flag: "🇦🇺" },
  { name: "Spain",            flag: "🇪🇸" },
  { name: "Mexico",           flag: "🇲🇽" },
  { name: "Indonesia",        flag: "🇮🇩" },
  { name: "Netherlands",      flag: "🇳🇱" },
  { name: "Saudi Arabia",     flag: "🇸🇦" },
  { name: "Turkey",           flag: "🇹🇷" },
  { name: "Switzerland",      flag: "🇨🇭" },
  { name: "Taiwan",           flag: "🇹🇼" },
  { name: "Poland",           flag: "🇵🇱" },
  { name: "Belgium",          flag: "🇧🇪" },
  { name: "Argentina",        flag: "🇦🇷" },
  { name: "Sweden",           flag: "🇸🇪" },
  { name: "Norway",           flag: "🇳🇴" },
  { name: "UAE",              flag: "🇦🇪" },
  { name: "Nigeria",          flag: "🇳🇬" },
  { name: "Egypt",            flag: "🇪🇬" },
  { name: "South Africa",     flag: "🇿🇦" },
];

export default function AboutPage() {
  return (
    <EditorialPage
      eyebrow="About"
      headline="About The Alignment Times"
    >
      <div className="space-y-16 md:space-y-20">

        {/* ── Mission statement ─────────────────────────────────────── */}
        <section>
          <div
            className="border-l-4 border-red-500 bg-cream-200 dark:bg-navy-400 px-8 py-8 md:py-10"
          >
            <p
              className="font-headline font-bold text-navy-500 dark:text-cream-100 leading-snug text-balance"
              style={{ fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)" }}
            >
              &ldquo;We believe financial news doesn&apos;t have to be either impenetrable
              or dumbed down. The Alignment Times covers markets, macroeconomics,
              and corporate culture with the rigour of a business publication
              and the wit of people who have sat through too many all-hands
              meetings.&rdquo;
            </p>
          </div>
        </section>

        {/* ── What we cover ─────────────────────────────────────────── */}
        <section>
          <div className="mb-8">
            <p className="label mb-2">Coverage</p>
            <h2
              className="font-headline font-bold text-navy-500 dark:text-cream-100 leading-tight"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}
            >
              Five sections. One publication.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {PILLARS.map((pillar) => (
              <Link
                key={pillar.href}
                href={pillar.href}
                className="
                  block border-t-4 border-navy-500 dark:border-cream-200
                  bg-cream-50 dark:bg-navy-400 p-5 md:p-6
                  no-underline group
                  hover:border-red-500 transition-colors duration-[120ms]
                "
              >
                <div className="flex items-start gap-4">
                  <span className="text-2xl shrink-0" role="img" aria-label={pillar.name}>
                    {pillar.icon}
                  </span>
                  <div>
                    <h3 className="font-headline font-bold text-navy-500 dark:text-cream-100 text-lg mb-2 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors duration-[120ms]">
                      {pillar.name}
                    </h3>
                    <p className="font-body text-sm text-ink-muted dark:text-cream-300 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 30 economies ──────────────────────────────────────────── */}
        <section>
          <div className="mb-6">
            <p className="label mb-2">Global coverage</p>
            <h2
              className="font-headline font-bold text-navy-500 dark:text-cream-100 leading-tight mb-4"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}
            >
              The world&apos;s 30 largest economies
            </h2>
            <p className="font-prose text-lg text-ink-muted dark:text-cream-300 leading-loose max-w-[680px]">
              We cover the top 30 economies by GDP — from the US and China to
              Nigeria and Egypt. Every story is filed through the lens of the
              professionals working in those markets.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ECONOMIES.map((economy) => (
              <div
                key={economy.name}
                title={economy.name}
                className="
                  flex items-center gap-1.5 px-3 py-1.5
                  bg-cream-200 dark:bg-navy-400
                  border border-rule dark:border-rule-dark
                  font-body text-xs text-ink-muted dark:text-cream-300
                  hover:border-navy-500 dark:hover:border-cream-200
                  transition-colors duration-[120ms]
                "
              >
                <span className="text-base" role="img" aria-hidden="true">{economy.flag}</span>
                <span className="hidden sm:inline">{economy.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Editorial standards ───────────────────────────────────── */}
        <section>
          <div className="mb-6">
            <p className="label mb-2">Standards</p>
            <h2
              className="font-headline font-bold text-navy-500 dark:text-cream-100 leading-tight"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}
            >
              Editorial standards
            </h2>
          </div>
          <div className="prose-editorial border-t border-rule dark:border-rule-dark pt-8">
            <p>
              The Alignment Times is independent. We are not funded by financial
              institutions, brokerages, or any party with a commercial interest in
              the markets we cover. Our journalism is funded by readers, not
              by the subjects we write about.
            </p>
            <p>
              <strong>Satire is labelled. Opinion is labelled. News is news.</strong>{" "}
              We never present invented statistics as fact. Our satirical voice frames
              real reporting — it never replaces it.
            </p>
            <p>
              We correct errors promptly and transparently. If you spot a factual
              error in our coverage, please email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> — we will review
              and correct within 24 hours.
            </p>
          </div>
        </section>

        {/* ── The team ──────────────────────────────────────────────── */}
        <section>
          <div className="mb-8">
            <p className="label mb-2">The team</p>
            <h2
              className="font-headline font-bold text-navy-500 dark:text-cream-100 leading-tight"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}
            >
              The editorial team
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {TEAM.map((member) => (
              <div
                key={member.name}
                className="border border-rule dark:border-rule-dark p-5 bg-cream-50 dark:bg-navy-400"
              >
                <div className="text-3xl mb-3" role="img" aria-label={member.name}>
                  {member.emoji}
                </div>
                <h3 className="font-headline font-bold text-navy-500 dark:text-cream-100 text-lg mb-0.5">
                  {member.name}
                </h3>
                <p className="font-body text-xs font-semibold tracking-widest uppercase text-gold-500 mb-3">
                  {member.title}
                </p>
                <p className="font-body text-sm text-ink-muted dark:text-cream-300 leading-relaxed">
                  {member.bio}
                </p>
              </div>
            ))}
          </div>

          {/* AI transparency note */}
          <div className="mt-8 p-5 border border-rule dark:border-rule-dark bg-cream-200 dark:bg-navy-400">
            <p className="font-body text-sm text-ink-muted dark:text-cream-300 leading-relaxed">
              <strong className="text-navy-500 dark:text-cream-100">A note on how this works:</strong>{" "}
              Our editorial content is written with AI assistance and reviewed by our
              human editor before publication. We believe in transparency about how
              this publication works — and we think that responsible AI-assisted
              journalism, done well, can cover more ground with more rigour than a
              small team working alone.
            </p>
          </div>
        </section>

        {/* ── Advertise ─────────────────────────────────────────────── */}
        <section>
          <div className="border-t-4 border-navy-500 dark:border-cream-200 pt-8">
            <p className="label mb-2">Work with us</p>
            <h2
              className="font-headline font-bold text-navy-500 dark:text-cream-100 leading-tight mb-4"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}
            >
              Advertise with us
            </h2>
            <p className="font-prose text-lg text-ink-muted dark:text-cream-300 leading-loose max-w-[600px] mb-6">
              The Alignment Times reaches senior professionals across 30 economies.
              If your brand belongs in that conversation, we&apos;d like to hear from you.
            </p>
            <Link
              href="/contact"
              className="
                inline-flex items-center
                font-body text-xs font-bold tracking-widest uppercase
                px-5 py-3 bg-navy-500 dark:bg-cream-100
                text-cream-100 dark:text-navy-500
                no-underline
                hover:bg-red-500 dark:hover:bg-red-400
                dark:hover:text-cream-100
                transition-colors duration-[120ms]
              "
            >
              Get in touch
            </Link>
          </div>
        </section>

        {/* ── Press ─────────────────────────────────────────────────── */}
        <section className="border-t border-rule dark:border-rule-dark pt-8">
          <p className="label mb-2">Press & syndication</p>
          <p className="font-prose text-lg text-ink-muted dark:text-cream-300 leading-loose">
            For press enquiries, interview requests, or content syndication, email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-navy-500 dark:text-cream-100"
            >
              {CONTACT_EMAIL}
            </a>.
          </p>
        </section>

      </div>
    </EditorialPage>
  );
}
