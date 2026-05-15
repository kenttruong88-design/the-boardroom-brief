import Link from "next/link";
import SubscribeForm from "@/app/components/newsletter/SubscribeForm";
import { getLatestArticles } from "@/app/lib/queries";
import { createAdminClient } from "@/app/lib/supabase-server";

export const revalidate = 300;

async function getSubscriberCount(): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { count } = await supabase
      .from("subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed");
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function SubscribePage() {
  const [subscriberCount, latestArticles] = await Promise.all([
    getSubscriberCount(),
    getLatestArticles(1),
  ]);

  const sampleArticle = latestArticles[0] ?? null;

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="container-editorial py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16 items-start">

          {/* ── Left column: 60% ─────────────────────────────────────────── */}
          <div className="lg:col-span-3">
            <p className="eyebrow mb-4">The Morning Brief</p>
            <h1
              className="text-4xl sm:text-5xl font-serif font-bold leading-tight mb-5"
              style={{ color: "var(--navy)" }}
            >
              The business news your colleagues are already reading.
            </h1>
            <p
              className="text-lg font-sans leading-relaxed mb-10"
              style={{ color: "var(--ink-m)" }}
            >
              Daily financial satire for senior professionals. Real markets,
              real news, served with a dry corporate twist.
            </p>

            {/* What you get */}
            <div className="mb-10">
              <p className="eyebrow-muted mb-5">Every weekday morning:</p>
              <ul className="space-y-3">
                {[
                  {
                    icon: "📈",
                    label: "Market snapshot",
                    desc: "Key indices before you open Slack",
                  },
                  {
                    icon: "📰",
                    label: "3–5 articles",
                    desc: "Across our 5 coverage pillars",
                  },
                  {
                    icon: "☕",
                    label: "One Water Cooler item",
                    desc: "Safe to share in the group chat",
                  },
                  {
                    icon: "✉️",
                    label: "In your inbox by 7:30 AM UTC",
                    desc: "",
                  },
                ].map((item) => (
                  <li key={item.label} className="flex items-start gap-3">
                    <span className="text-lg leading-snug flex-shrink-0">
                      {item.icon}
                    </span>
                    <span className="text-base font-sans" style={{ color: "var(--ink)" }}>
                      <strong>{item.label}</strong>
                      {item.desc && (
                        <span style={{ color: "var(--ink-m)" }}>
                          {" "}
                          — {item.desc}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social proof */}
            {subscriberCount > 0 && (
              <p className="text-sm font-sans mb-10" style={{ color: "var(--ink-m)" }}>
                <span style={{ color: "var(--navy)", fontWeight: 600 }}>
                  Join {subscriberCount.toLocaleString()} professionals
                </span>{" "}
                who start their morning here.
              </p>
            )}

            {/* Sample article card */}
            {sampleArticle && (
              <div>
                <p className="eyebrow-muted mb-3">Latest from the Brief</p>
                <Link
                  href={`/${sampleArticle.pillar?.slug?.current ?? "markets-floor"}/${sampleArticle.slug.current}`}
                  className="block group"
                >
                  <div
                    className="p-5 transition-colors"
                    style={{
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                    }}
                  >
                    <span
                      className="eyebrow mb-2 inline-block"
                      style={{ color: "var(--red)" }}
                    >
                      {sampleArticle.pillar?.name ?? "Markets Floor"}
                    </span>
                    <h3
                      className="font-serif font-bold text-lg leading-snug mb-2 group-hover:opacity-70 transition-opacity"
                      style={{ color: "var(--navy)" }}
                    >
                      {sampleArticle.title}
                    </h3>
                    {sampleArticle.satiricalHeadline && (
                      <p
                        className="font-serif italic text-sm"
                        style={{ color: "var(--red)" }}
                      >
                        {sampleArticle.satiricalHeadline}
                      </p>
                    )}
                    <p className="text-xs font-sans mt-2 group-hover:opacity-70 transition-opacity" style={{ color: "var(--red)" }}>
                      Read this article →
                    </p>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* ── Right column: 40% ────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-6">
              <div
                className="p-8"
                style={{ background: "var(--navy)", borderRadius: "2px" }}
              >
                <p
                  className="eyebrow-gold mb-3"
                  style={{ color: "var(--gold)" }}
                >
                  Free newsletter
                </p>
                <h2
                  className="font-serif font-bold text-xl mb-2"
                  style={{ color: "var(--cream)" }}
                >
                  Start tomorrow morning.
                </h2>
                <p
                  className="text-sm font-sans mb-6"
                  style={{ color: "rgba(245,240,232,0.6)" }}
                >
                  One email. Five stories. No noise.
                </p>

                <SubscribeForm source="subscribe-page" dark />

                <p
                  className="text-xs font-sans text-center mt-5"
                  style={{ color: "rgba(245,240,232,0.3)" }}
                >
                  No spam. Unsubscribe anytime. GDPR compliant.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
