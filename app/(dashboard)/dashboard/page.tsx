import Link from "next/link";
import {
  Newspaper,
  Rss,
  MessageSquare,
  Share2,
  FlaskConical,
  LayoutGrid,
  Mail,
  Search,
  Activity,
} from "lucide-react";

const LINKS = [
  {
    href: "/activity",
    icon: Activity,
    label: "Daily activity",
    description: "Articles, social posts, newsletter, comments, subscribers — today at a glance",
  },
  {
    href: "/editorial",
    icon: LayoutGrid,
    label: "Editorial",
    description: "Daily digest overview and article approvals",
  },
  {
    href: "/editorial/news-feed",
    icon: Rss,
    label: "News feed",
    description: "Manage incoming RSS articles and sources",
  },
  {
    href: "/editorial/comments",
    icon: MessageSquare,
    label: "Comments",
    description: "Moderate reader comments",
  },
  {
    href: "/newsletter",
    icon: Mail,
    label: "Newsletter",
    description: "Subscriber stats, send history, and email test lab",
  },
  {
    href: "/social",
    icon: Share2,
    label: "Social media",
    description: "Schedule, approve, and publish social posts",
  },
  {
    href: "/studio",
    icon: Newspaper,
    label: "Sanity Studio",
    description: "Edit content and manage the CMS",
  },
  {
    href: "/test/social",
    icon: FlaskConical,
    label: "Social test",
    description: "Test the social media pipeline end-to-end",
  },
  {
    href: "/search",
    icon: Search,
    label: "Search analytics",
    description: "Top queries, zero-result gaps, 7-day volume",
  },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--cream)" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1
          className="text-3xl font-serif font-bold mb-1"
          style={{ color: "var(--navy)" }}
        >
          The Alignment Times
        </h1>
        <p
          className="text-sm font-sans mb-10"
          style={{ color: "var(--ink-m)" }}
        >
          Internal dashboard
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map(({ href, icon: Icon, label, description }) => (
            <Link
              key={href}
              href={href}
              className="group block p-5 transition-colors"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Icon
                  className="w-5 h-5 flex-shrink-0"
                  style={{ color: "var(--navy)" }}
                />
                <span
                  className="font-sans font-semibold text-sm"
                  style={{ color: "var(--ink)" }}
                >
                  {label}
                </span>
              </div>
              <p
                className="text-xs font-sans leading-relaxed"
                style={{ color: "var(--ink-m)" }}
              >
                {description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
