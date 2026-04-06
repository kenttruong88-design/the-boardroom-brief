import Link from "next/link";
import { ECONOMIES } from "@/app/lib/mock-data";

const REGIONS = ["Americas", "Europe", "Asia-Pacific", "Middle East & Africa"];

export default function EconomiesPage() {
  return (
    <div style={{ background: "var(--cream)" }}>

      <div style={{ background: "var(--navy)", borderBottom: "3px solid var(--red)" }}>
        <div className="container-editorial py-10">
          <span className="eyebrow-gold" style={{ color: "var(--gold)" }}>Intelligence</span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold mt-2 mb-2" style={{ color: "var(--cream)" }}>
            30 Economies
          </h1>
          <p className="text-sm font-sans max-w-xl" style={{ color: "rgba(245,240,232,0.55)" }}>
            Macro intelligence, key indicators, and executive briefings on the economies that shape global business.
          </p>
        </div>
      </div>

      <div className="container-editorial py-12 space-y-14">
        {REGIONS.map((region) => {
          const economies = ECONOMIES.filter((e) => e.region === region);
          return (
            <section key={region}>
              <div className="rule-thick mb-5" />
              <h2 className="eyebrow mb-6">{region}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {economies.map((economy) => (
                  <Link
                    key={economy.slug}
                    href={`/economies/${economy.slug}`}
                    className="hover-card p-4 text-center block"
                    style={{ background: "var(--surface)", borderRadius: "2px" }}
                  >
                    <div className="text-3xl mb-1">{economy.flag}</div>
                    <div className="text-xs font-bold" style={{ color: "var(--navy)", fontFamily: "var(--font-jetbrains)" }}>
                      {economy.code}
                    </div>
                    <div className="text-xs font-sans mt-0.5 leading-tight" style={{ color: "var(--ink-m)" }}>
                      {economy.name}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
