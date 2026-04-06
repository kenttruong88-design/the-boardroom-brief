import Link from "next/link";
import { PILLARS } from "@/app/lib/mock-data";

export default function Footer() {
  return (
    <footer style={{ background: "var(--navy)", color: "var(--cream)" }}>
      <div className="container-editorial py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Col 1: Brand */}
          <div>
            <div
              className="text-2xl font-serif font-bold mb-3"
              style={{ color: "var(--cream)" }}
            >
              The Boardroom Brief
            </div>
            <p
              className="text-sm font-sans mb-6 leading-relaxed"
              style={{ color: "rgba(245,240,232,0.6)" }}
            >
              Real markets. Real news. Questionable corporate poetry.
            </p>
            <p
              className="text-xs font-sans"
              style={{ color: "rgba(245,240,232,0.4)", fontFamily: "var(--font-jetbrains)" }}
            >
              Executive intelligence for leaders who shape the global economy.
            </p>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <h4
              className="eyebrow-gold mb-5"
              style={{ color: "var(--gold)" }}
            >
              Coverage
            </h4>
            <ul className="space-y-2.5">
              {PILLARS.map((pillar) => (
                <li key={pillar.slug}>
                  <Link
                    href={`/${pillar.slug}`}
                    className="text-sm font-sans transition-colors hover:text-white"
                    style={{ color: "rgba(245,240,232,0.55)" }}
                  >
                    {pillar.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/economies"
                  className="text-sm font-sans transition-colors hover:text-white"
                  style={{ color: "rgba(245,240,232,0.55)" }}
                >
                  30 Economies
                </Link>
              </li>
            </ul>

            <div className="mt-6 space-y-2">
              {["About", "Advertise", "Contact"].map((item) => (
                <div key={item}>
                  <Link
                    href={`/${item.toLowerCase()}`}
                    className="text-sm font-sans transition-colors hover:text-white"
                    style={{ color: "rgba(245,240,232,0.4)" }}
                  >
                    {item}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Col 3: Newsletter */}
          <div>
            <h4 className="eyebrow-gold mb-3" style={{ color: "var(--gold)" }}>
              Daily Brief
            </h4>
            <p
              className="text-sm font-sans mb-5 leading-relaxed"
              style={{ color: "rgba(245,240,232,0.6)" }}
            >
              The five stories every executive needs before 8am. Free, always.
            </p>
            <form className="space-y-2">
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full text-sm font-sans px-4 py-2.5 outline-none transition-colors"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "var(--cream)",
                }}
              />
              <button
                type="submit"
                className="w-full btn-red text-center"
              >
                Get the brief
              </button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="border-t mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <p
            className="text-xs"
            style={{ color: "rgba(245,240,232,0.35)", fontFamily: "var(--font-jetbrains)" }}
          >
            © {new Date().getFullYear()} The Boardroom Brief. All rights reserved.
          </p>
          <div className="flex gap-6">
            {["Privacy", "Terms", "Cookies"].map((item) => (
              <Link
                key={item}
                href={`/${item.toLowerCase()}`}
                className="text-xs transition-colors hover:text-cream"
                style={{
                  color: "rgba(245,240,232,0.35)",
                  fontFamily: "var(--font-jetbrains)",
                }}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
