import type { Metadata } from "next";
import EditorialPage from "@/app/components/editorial-page/EditorialPage";

const LAST_UPDATED = "26 May 2026";
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@boardroombrief.com";

export const metadata: Metadata = {
  title: "Cookie Policy | The Boardroom Brief",
  description: "A complete and honest list of the cookies used by The Boardroom Brief.",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  { id: "overview",   label: "Overview" },
  { id: "essential",  label: "Essential cookies" },
  { id: "analytics",  label: "Analytics cookies" },
  { id: "no-ads",     label: "What we don't use" },
  { id: "control",    label: "How to control cookies" },
  { id: "contact",    label: "Contact" },
];

export default function CookiesPage() {
  return (
    <EditorialPage
      eyebrow="Legal"
      headline="Cookie Policy"
      lastUpdated={LAST_UPDATED}
      sections={SECTIONS}
    >
      <div className="prose-editorial">

        <section id="overview">
          <h2>Overview</h2>
          <p>
            We have tried hard to minimise our use of cookies. This page is a
            complete and honest list of every cookie we use and why. No small print.
            No buried tracking. Just what it says.
          </p>
          <p>
            The short version: we use one cookie to keep you logged in, and
            Plausible Analytics which is cookieless by default. That&apos;s it.
          </p>
        </section>

        <section id="essential">
          <h2>Essential cookies</h2>
          <p>
            Essential cookies are required for the site to function. They do not
            track you for advertising purposes and do not require your consent.
          </p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Purpose</th>
                <th>Duration</th>
                <th>Required</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: "0.875rem",
                      background: "rgba(15,25,35,0.06)",
                      padding: "1px 6px",
                      borderRadius: "2px",
                    }}
                  >
                    supabase-auth-token
                  </code>
                </td>
                <td>Keeps you logged in to your account</td>
                <td>Session</td>
                <td>Yes — essential</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section id="analytics">
          <h2>Analytics cookies</h2>
          <p>
            We use <a href="https://plausible.io" target="_blank" rel="noopener noreferrer">
              Plausible Analytics
            </a> to understand how readers use the site. Plausible is a privacy-first
            analytics tool that does not use cookies and does not collect any personally
            identifiable information.
          </p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Purpose</th>
                <th>Duration</th>
                <th>Required</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: "0.875rem",
                      background: "rgba(15,25,35,0.06)",
                      padding: "1px 6px",
                      borderRadius: "2px",
                    }}
                  >
                    __plausible
                  </code>
                </td>
                <td>Prevents double-counting page views from the same visitor</td>
                <td>24 hours</td>
                <td>No — optional</td>
              </tr>
            </tbody>
          </table>
          <p>
            Plausible does not build a profile of you. It does not track you across
            websites. It does not share data with advertising networks. You can read
            their full privacy policy at{" "}
            <a href="https://plausible.io/privacy" target="_blank" rel="noopener noreferrer">
              plausible.io/privacy
            </a>.
          </p>
        </section>

        <section id="no-ads">
          <h2>What we don&apos;t use</h2>
          <p>To be explicit about what is absent:</p>
          <ul>
            <li>No advertising cookies of any kind</li>
            <li>No retargeting or remarketing pixels</li>
            <li>No third-party tracking scripts (Google Ads, Meta Pixel, etc.)</li>
            <li>No fingerprinting</li>
            <li>No cross-site tracking</li>
          </ul>
          <p>
            We are an independent publication. We are not funded by advertising networks,
            and we have no commercial reason to track you.
          </p>
        </section>

        <section id="control">
          <h2>How to control cookies</h2>
          <p>
            You can control and delete cookies through your browser settings. Here are
            links to instructions for the most common browsers:
          </p>
          <ul>
            <li>
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
                Google Chrome
              </a>
            </li>
            <li>
              <a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer">
                Mozilla Firefox
              </a>
            </li>
            <li>
              <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer">
                Safari
              </a>
            </li>
            <li>
              <a href="https://support.microsoft.com/en-us/windows/manage-cookies-in-microsoft-edge" target="_blank" rel="noopener noreferrer">
                Microsoft Edge
              </a>
            </li>
          </ul>
          <p>
            Note that disabling the essential session cookie will prevent you from
            logging in to your account. Analytics cookies have no impact on site
            functionality.
          </p>
        </section>

        <section id="contact">
          <h2>Contact</h2>
          <p>
            Questions about our cookie use? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or use our{" "}
            <a href="/contact">contact form</a>.
          </p>
        </section>

      </div>
    </EditorialPage>
  );
}
