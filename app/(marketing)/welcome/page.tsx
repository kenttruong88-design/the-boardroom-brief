import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface Props {
  searchParams: Promise<{ subscribed?: string; email?: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://alignmenttimes.com";

export default async function WelcomePage({ searchParams }: Props) {
  const params = await searchParams;
  const isConfirmed = params.subscribed === "true";
  const email = params.email ? decodeURIComponent(params.email) : null;

  const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${SITE_URL}/subscribe`)}`;

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="container-editorial py-20">
        <div className="max-w-2xl mx-auto">

          {isConfirmed ? (
            <>
              {/* ── Confirmed state ── */}
              <div className="text-center mb-12">
                <div
                  className="w-16 h-16 flex items-center justify-center mx-auto mb-6"
                  style={{ background: "#dcfce7", borderRadius: "50%" }}
                >
                  <CheckCircle2 className="w-8 h-8" style={{ color: "#16a34a" }} />
                </div>
                <p className="eyebrow mb-3" style={{ color: "var(--red)" }}>Confirmed</p>
                <h1
                  className="text-4xl font-serif font-bold mb-4"
                  style={{ color: "var(--navy)" }}
                >
                  You&apos;re in. Welcome to the Brief.
                </h1>
                {email && (
                  <p className="text-base font-sans" style={{ color: "var(--ink-m)" }}>
                    Confirmation sent to{" "}
                    <strong style={{ color: "var(--ink)" }}>{email}</strong>
                  </p>
                )}
              </div>

              {/* What happens next */}
              <div
                className="p-8 mb-8"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <h2
                  className="font-serif font-bold text-lg mb-6"
                  style={{ color: "var(--navy)" }}
                >
                  What happens next
                </h2>
                <ul className="space-y-4">
                  {[
                    {
                      step: "1",
                      text: "Tomorrow morning at 7:30 AM UTC, your first Morning Brief arrives.",
                    },
                    {
                      step: "2",
                      text: "Add hello@alignmenttimes.com to your contacts so we don't land in spam.",
                    },
                    {
                      step: "3",
                      text: "Customise your preferences — choose pillars, economies, and frequency.",
                    },
                  ].map((item) => (
                    <li key={item.step} className="flex items-start gap-4">
                      <span
                        className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-sans font-bold"
                        style={{
                          background: "var(--navy)",
                          color: "var(--cream)",
                          borderRadius: "2px",
                        }}
                      >
                        {item.step}
                      </span>
                      <p className="text-sm font-sans leading-relaxed" style={{ color: "var(--ink)" }}>
                        {item.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <Link href="/preferences" className="btn-red flex items-center justify-center gap-2">
                  Customise my preferences <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/" className="btn-outline flex items-center justify-center gap-2">
                  Read today&apos;s articles
                </Link>
              </div>

              {/* Share widget */}
              <div
                className="p-6 text-center"
                style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
              >
                <p className="eyebrow-muted mb-2">Know someone who&apos;d enjoy this?</p>
                <p className="text-sm font-sans mb-4" style={{ color: "var(--ink-m)" }}>
                  Share The Alignment Times with a colleague.
                </p>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-navy inline-flex items-center gap-2"
                >
                  Share on LinkedIn
                </a>
              </div>
            </>
          ) : (
            <>
              {/* ── Generic welcome (direct navigation) ── */}
              <div className="text-center">
                <p className="eyebrow mb-4" style={{ color: "var(--red)" }}>The Morning Brief</p>
                <h1
                  className="text-4xl font-serif font-bold mb-4"
                  style={{ color: "var(--navy)" }}
                >
                  Welcome to The Alignment Times.
                </h1>
                <p className="text-lg font-sans mb-8" style={{ color: "var(--ink-m)" }}>
                  Daily financial news with a dry corporate culture twist.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/subscribe" className="btn-red">Subscribe free</Link>
                  <Link href="/" className="btn-outline">Read today&apos;s articles</Link>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
