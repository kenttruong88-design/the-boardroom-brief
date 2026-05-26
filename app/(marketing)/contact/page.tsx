import type { Metadata } from "next";
import EditorialPage from "@/app/components/editorial-page/EditorialPage";
import ContactForm from "./ContactForm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://boardroombrief.com";
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@boardroombrief.com";

// Derive domain from SITE_URL for display (strip protocol)
const domain = SITE_URL.replace(/^https?:\/\//, "");

export const metadata: Metadata = {
  title: "Contact | The Boardroom Brief",
  description: "Get in touch with The Boardroom Brief editorial team.",
  openGraph: {
    title: "Contact | The Boardroom Brief",
    description: "Get in touch with The Boardroom Brief editorial team.",
    type: "website",
  },
};

const CONTACT_REASONS = [
  {
    icon: "📰",
    title: "Editorial",
    subtitle: "Story tips, corrections, press enquiries",
    email: `editorial@${domain}`,
  },
  {
    icon: "📊",
    title: "Advertising",
    subtitle: "Sponsorship and newsletter partnerships",
    email: `advertising@${domain}`,
  },
  {
    icon: "⚙️",
    title: "Technical",
    subtitle: "Site issues, broken links, data errors",
    email: CONTACT_EMAIL,
  },
  {
    icon: "🔒",
    title: "Data & Privacy",
    subtitle: "GDPR requests, data deletion, privacy concerns",
    email: `privacy@${domain}`,
  },
];

export default function ContactPage() {
  return (
    <EditorialPage
      eyebrow="Get in touch"
      headline="Contact"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

        {/* ── Left column: contact reasons ──────────────────────────── */}
        <div>
          <p className="font-prose text-lg text-ink-muted dark:text-cream-300 leading-loose mb-8">
            Choose the right inbox and we&apos;ll make sure your message gets to
            the right person. We aim to respond within 2 business days.
          </p>

          <div className="space-y-4">
            {CONTACT_REASONS.map((reason) => (
              <div
                key={reason.title}
                className="
                  border-t-2 border-navy-500 dark:border-cream-200
                  bg-cream-50 dark:bg-navy-400
                  p-5
                  hover:border-red-500 transition-colors duration-[120ms]
                "
              >
                <div className="flex items-start gap-4">
                  <span
                    className="text-2xl shrink-0 mt-0.5"
                    role="img"
                    aria-label={reason.title}
                  >
                    {reason.icon}
                  </span>
                  <div>
                    <h3 className="font-headline font-bold text-navy-500 dark:text-cream-100 text-lg mb-0.5">
                      {reason.title}
                    </h3>
                    <p className="font-body text-sm text-ink-muted dark:text-cream-300 mb-2">
                      {reason.subtitle}
                    </p>
                    <a
                      href={`mailto:${reason.email}`}
                      className="
                        font-data text-xs text-navy-500 dark:text-cream-200
                        tracking-wide
                        hover:text-red-500 dark:hover:text-red-400
                        transition-colors duration-[120ms]
                      "
                    >
                      {reason.email}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right column: contact form ─────────────────────────────── */}
        <div>
          <div className="mb-6 pb-6 border-b border-rule dark:border-rule-dark">
            <p className="label mb-1">Send a message</p>
            <p className="font-body text-sm text-ink-muted dark:text-cream-300">
              Prefer a form? Use this.
            </p>
          </div>
          <ContactForm />
        </div>

      </div>
    </EditorialPage>
  );
}
