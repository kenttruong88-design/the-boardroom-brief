import type { Metadata } from "next";
import EditorialPage from "@/app/components/editorial-page/EditorialPage";

const LAST_UPDATED = "26 May 2026";
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@boardroombrief.com";

export const metadata: Metadata = {
  title: "Terms of Service | The Boardroom Brief",
  description: "Terms and conditions for using The Boardroom Brief.",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  { id: "acceptance",      label: "1. Acceptance" },
  { id: "what-we-provide", label: "2. What we provide" },
  { id: "intellectual-property", label: "3. Intellectual property" },
  { id: "comments",        label: "4. User comments" },
  { id: "newsletter",      label: "5. Newsletter" },
  { id: "disclaimer",      label: "6. Disclaimer" },
  { id: "liability",       label: "7. Limitation of liability" },
  { id: "governing-law",   label: "8. Governing law" },
  { id: "contact",         label: "9. Contact" },
];

export default function TermsPage() {
  return (
    <EditorialPage
      eyebrow="Legal"
      headline="Terms of Service"
      lastUpdated={LAST_UPDATED}
      sections={SECTIONS}
    >
      <div className="prose-editorial">

        <section id="acceptance">
          <h2>1. Acceptance</h2>
          <p>
            By accessing or using The Boardroom Brief, you agree to be bound by these
            Terms of Service. If you do not agree to these terms, please do not use
            the site.
          </p>
          <p>
            We may update these terms from time to time. Continued use of the site
            after changes are published constitutes your acceptance of the revised terms.
          </p>
        </section>

        <section id="what-we-provide">
          <h2>2. What we provide</h2>
          <p>
            The Boardroom Brief is an independent news and commentary publication.
            Content is provided for informational and entertainment purposes only.
          </p>
          <p>
            <strong>Nothing on this site constitutes financial advice.</strong> Nothing
            on this site should be construed as a recommendation to buy, sell, or hold
            any financial instrument, security, or asset. Always consult a qualified
            financial professional before making investment decisions.
          </p>
        </section>

        <section id="intellectual-property">
          <h2>3. Content and intellectual property</h2>
          <p>
            All original editorial content — articles, headlines, analysis, satire,
            graphics, and commentary — is owned by The Boardroom Brief and is protected
            by copyright law.
          </p>
          <p>You may:</p>
          <ul>
            <li>Share individual articles with proper attribution and a link back to the original URL</li>
            <li>Quote brief excerpts for the purposes of commentary or criticism</li>
          </ul>
          <p>You may not:</p>
          <ul>
            <li>Reproduce entire articles without written permission</li>
            <li>Systematically scrape or reproduce portions of our content</li>
            <li>Use our content for commercial purposes without a licence</li>
            <li>Remove or alter copyright notices</li>
          </ul>
          <p>
            To request permission for syndication or reproduction, contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </section>

        <section id="comments">
          <h2>4. User-generated content (comments)</h2>
          <p>
            By posting a comment on The Boardroom Brief, you grant us a non-exclusive,
            royalty-free licence to display, reproduce, and moderate that comment on
            the site. You retain ownership of your comments, but you are solely
            responsible for their content.
          </p>
          <p>The following are strictly prohibited in comments:</p>
          <ul>
            <li>Spam and unsolicited commercial messages</li>
            <li>Harassment, threats, or personal attacks</li>
            <li>Hate speech, discrimination, or content that targets individuals or groups</li>
            <li>Illegal content of any kind</li>
            <li>Impersonation of other individuals or organisations</li>
            <li>Off-topic promotion or advertising</li>
          </ul>
          <p>
            We reserve the right to remove any comment and permanently ban any user
            without notice, at our sole discretion.
          </p>
        </section>

        <section id="newsletter">
          <h2>5. Newsletter</h2>
          <p>
            The Morning Brief is delivered to confirmed subscribers who have opted in
            via our subscription form. You can unsubscribe at any time using the
            unsubscribe link included in every email.
          </p>
          <p>
            We reserve the right to modify the newsletter format, frequency, or content
            at any time, or to discontinue the newsletter with reasonable notice to
            subscribers.
          </p>
        </section>

        <section id="disclaimer">
          <h2>6. Disclaimer</h2>
          <p>
            Market data and financial information on this site is provided for
            informational purposes only. We strive for accuracy but cannot guarantee
            that all data is current, complete, or correct. Always verify financial
            data with primary sources before making any decisions.
          </p>
          <p>
            Satire and opinion content is clearly labelled as such and represents
            editorial voice, not factual reporting. Any resemblance to actionable
            financial advice is purely coincidental and, frankly, alarming.
          </p>
        </section>

        <section id="liability">
          <h2>7. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by applicable law, The Boardroom Brief
            and its contributors, editors, and operators shall not be liable for any
            direct, indirect, incidental, special, or consequential losses or damages
            arising from:
          </p>
          <ul>
            <li>Your use of, or inability to use, this site</li>
            <li>Reliance on any content published on this site</li>
            <li>Unauthorised access to or alteration of your data</li>
            <li>Any other matter relating to the site</li>
          </ul>
          <p>
            This limitation applies regardless of whether the claim is based on
            warranty, contract, tort, or any other legal theory.
          </p>
        </section>

        <section id="governing-law">
          <h2>8. Governing law</h2>
          <p>
            These terms are governed by the laws of the jurisdiction in which the
            publisher is established. Any disputes arising from these terms or your
            use of the site shall be subject to the exclusive jurisdiction of the
            courts in that jurisdiction.
          </p>
        </section>

        <section id="contact">
          <h2>9. Contact</h2>
          <p>
            Questions about these terms? Email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
          <p>
            You may also use our{" "}
            <a href="/contact">contact form</a> to get in touch.
          </p>
        </section>

      </div>
    </EditorialPage>
  );
}
