import type { Metadata } from "next";
import EditorialPage from "@/app/components/editorial-page/EditorialPage";

const LAST_UPDATED = "26 May 2026";

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@boardroombrief.com";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://boardroombrief.com";

export const metadata: Metadata = {
  title: "Privacy Policy | The Boardroom Brief",
  description: "How The Boardroom Brief collects, uses, and protects your personal data.",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  { id: "who-we-are",        label: "1. Who we are" },
  { id: "what-we-collect",   label: "2. What data we collect" },
  { id: "how-we-use",        label: "3. How we use your data" },
  { id: "legal-basis",       label: "4. Legal basis (GDPR)" },
  { id: "storage-security",  label: "5. Storage & security" },
  { id: "third-parties",     label: "6. Third-party services" },
  { id: "your-rights",       label: "7. Your rights" },
  { id: "account-deletion",  label: "8. Account deletion" },
  { id: "cookies",           label: "9. Cookies" },
  { id: "changes",           label: "10. Changes to this policy" },
  { id: "contact",           label: "11. Contact" },
];

export default function PrivacyPage() {
  return (
    <EditorialPage
      eyebrow="Legal"
      headline="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      sections={SECTIONS}
    >
      <div className="prose-editorial">

        <section id="who-we-are">
          <h2>1. Who we are</h2>
          <p>
            The Boardroom Brief is an independent financial news publication operating at{" "}
            <a href={SITE_URL} target="_blank" rel="noopener noreferrer">{SITE_URL}</a>.
            We cover business news, financial markets, and corporate culture across the
            world&apos;s 30 largest economies.
          </p>
          <p>
            For data protection purposes, The Boardroom Brief is the data controller.
            If you have any questions about how we handle your data, contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </section>

        <section id="what-we-collect">
          <h2>2. What data we collect</h2>

          <h3>2.1 Data you provide directly</h3>
          <ul>
            <li>Email address (when subscribing to the newsletter)</li>
            <li>First name (optional, for newsletter personalisation)</li>
            <li>Comments (when commenting on articles)</li>
            <li>Contact form submissions</li>
          </ul>

          <h3>2.2 Data collected automatically</h3>
          <ul>
            <li>IP address (hashed and anonymised for spam prevention)</li>
            <li>Browser and device type (via analytics)</li>
            <li>Pages visited and time spent (via Plausible Analytics)</li>
            <li>Email opens and link clicks (via our newsletter provider)</li>
          </ul>

          <h3>2.3 What we do NOT collect</h3>
          <ul>
            <li>We do not sell your data to third parties. Ever.</li>
            <li>We do not run advertising tracking pixels.</li>
            <li>We do not use cookies for advertising purposes.</li>
            <li>We do not build advertising profiles.</li>
          </ul>
        </section>

        <section id="how-we-use">
          <h2>3. How we use your data</h2>
          <ul>
            <li>
              <strong>Newsletter delivery:</strong> to send you the Morning Brief you subscribed to
            </li>
            <li>
              <strong>Comment moderation:</strong> to review and publish your comments
            </li>
            <li>
              <strong>Spam prevention:</strong> hashed IP addresses to prevent abuse
            </li>
            <li>
              <strong>Analytics:</strong> to understand which content our readers find valuable
              (using Plausible Analytics — privacy-first, no personal data stored)
            </li>
            <li>
              <strong>Legal compliance:</strong> to meet our obligations under applicable law
            </li>
          </ul>
        </section>

        <section id="legal-basis">
          <h2>4. Legal basis for processing (GDPR)</h2>
          <p>For EU/EEA residents, our legal bases for processing personal data are:</p>
          <ul>
            <li>
              <strong>Consent:</strong> newsletter subscriptions — you opted in, and you can
              opt out at any time via the unsubscribe link in every email
            </li>
            <li>
              <strong>Legitimate interests:</strong> spam prevention and site security
            </li>
            <li>
              <strong>Legal obligation:</strong> compliance with applicable laws
            </li>
          </ul>
        </section>

        <section id="storage-security">
          <h2>5. Data storage and security</h2>
          <p>
            Your data is stored securely on Supabase infrastructure. Newsletter emails
            are processed by Resend. Both providers operate under strict data protection
            agreements and maintain industry-standard security practices.
          </p>
          <p>
            We retain subscriber data for as long as your subscription is active.
            Unsubscribed accounts are deleted after 12 months.
            Comment data is retained indefinitely unless you request deletion.
          </p>
        </section>

        <section id="third-parties">
          <h2>6. Third-party services</h2>
          <p>We use the following services to operate The Boardroom Brief:</p>
          <ul>
            <li>
              <strong>Supabase</strong> (database and authentication) —{" "}
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
                supabase.com/privacy
              </a>
            </li>
            <li>
              <strong>Resend</strong> (email delivery) —{" "}
              <a href="https://resend.com/privacy" target="_blank" rel="noopener noreferrer">
                resend.com/privacy
              </a>
            </li>
            <li>
              <strong>Cloudinary</strong> (image hosting) —{" "}
              <a href="https://cloudinary.com/privacy_policy" target="_blank" rel="noopener noreferrer">
                cloudinary.com/privacy_policy
              </a>
            </li>
            <li>
              <strong>Vercel</strong> (hosting and infrastructure) —{" "}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                vercel.com/legal/privacy-policy
              </a>
            </li>
            <li>
              <strong>Plausible Analytics</strong> (cookieless, privacy-first analytics) —{" "}
              <a href="https://plausible.io/privacy" target="_blank" rel="noopener noreferrer">
                plausible.io/privacy
              </a>
            </li>
            <li>
              <strong>Buffer</strong> (social media scheduling) —{" "}
              <a href="https://buffer.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                buffer.com/legal/privacy-policy
              </a>
            </li>
          </ul>
          <p>
            We do not share your personal data with any of these services beyond what is
            strictly necessary to operate the publication.
          </p>
        </section>

        <section id="your-rights">
          <h2>7. Your rights (GDPR)</h2>
          <p>
            If you are based in the EU or EEA, you have the following rights regarding
            your personal data:
          </p>
          <ul>
            <li><strong>Right to access</strong> — request a copy of the data we hold about you</li>
            <li><strong>Right to rectification</strong> — ask us to correct inaccurate data</li>
            <li><strong>Right to erasure</strong> — ask us to delete your data</li>
            <li><strong>Right to portability</strong> — receive your data in a machine-readable format</li>
            <li><strong>Right to object</strong> — object to our processing of your data</li>
            <li><strong>Right to restrict processing</strong> — ask us to limit how we use your data</li>
            <li>
              <strong>Right to withdraw consent</strong> — for newsletter subscriptions,
              there is an unsubscribe link in every email
            </li>
            <li>
              <strong>Right to lodge a complaint</strong> — with your local supervisory authority
            </li>
          </ul>
          <p>
            To exercise any of these rights, email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            We will respond within 30 days.
          </p>
        </section>

        <section id="account-deletion">
          <h2>8. Account deletion</h2>
          <p>
            To request deletion of your account and all associated data, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the subject line
            &quot;Data deletion request&quot;. We will process your request within 30 days and
            confirm by email when deletion is complete.
          </p>
        </section>

        <section id="cookies">
          <h2>9. Cookies</h2>
          <p>
            We use minimal cookies. Here&apos;s the complete list:
          </p>
          <ul>
            <li>
              <strong>Session cookie</strong> (supabase-auth-token): keeps you logged in.
              This is an essential cookie — the site cannot function without it.
              No consent required.
            </li>
            <li>
              <strong>Plausible Analytics</strong>: cookieless by default. No personal data
              is collected or stored. No consent required.
            </li>
          </ul>
          <p>
            We do not use advertising cookies, retargeting pixels, or any third-party
            tracking cookies. See our full{" "}
            <a href="/cookies">Cookie Policy</a> for details.
          </p>
        </section>

        <section id="changes">
          <h2>10. Changes to this policy</h2>
          <p>
            We will notify subscribers by email of any material changes to this policy.
            The &quot;Last updated&quot; date at the top of this page reflects the most recent
            revision. We encourage you to review this policy periodically.
          </p>
        </section>

        <section id="contact">
          <h2>11. Contact</h2>
          <p>
            <strong>Data controller:</strong> The Boardroom Brief
            <br />
            <strong>Email:</strong>{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
          <p>
            We take privacy seriously. If something in this policy is unclear or you
            have a concern, please reach out — we will respond promptly.
          </p>
        </section>

      </div>
    </EditorialPage>
  );
}
