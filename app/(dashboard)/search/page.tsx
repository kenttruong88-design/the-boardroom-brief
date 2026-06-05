"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Search, TrendingUp, AlertCircle, Loader2 } from "lucide-react";

interface Analytics {
  totalSearches: number;
  topQueries: { query: string; count: number; zeroResultCount: number }[];
  zeroResultQueries: { query: string; count: number }[];
  dailyVolume: { date: string; searches: number }[];
}

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div
      className="p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4" style={{ color: "var(--navy)" }} />
        <h2 className="font-sans font-semibold text-sm" style={{ color: "var(--ink)" }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

export default function SearchAnalyticsPage() {
  const [data, setData]     = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [days, setDays]     = useState(7);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/search/analytics?days=${days}`)
      .then((r) => r.json())
      .then((d: Analytics & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("Failed to load analytics."))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <main className="min-h-screen" style={{ background: "var(--cream)" }}>
      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-serif font-bold mb-1" style={{ color: "var(--navy)" }}>
              Search Analytics
            </h1>
            <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>
              What readers are searching for
            </p>
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="font-sans text-sm border px-3 py-1.5 outline-none"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--ink-m)" }} />
          </div>
        )}

        {error && (
          <p className="text-sm font-sans py-4" style={{ color: "var(--red)" }}>{error}</p>
        )}

        {data && !loading && (
          <div className="space-y-6">

            {/* Summary stat */}
            <div
              className="p-5 flex items-center gap-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Search className="w-8 h-8" style={{ color: "var(--navy)" }} />
              <div>
                <p className="font-serif text-3xl font-bold" style={{ color: "var(--navy)" }}>
                  {data.totalSearches.toLocaleString()}
                </p>
                <p className="font-sans text-sm" style={{ color: "var(--ink-m)" }}>
                  searches in the last {days} days
                </p>
              </div>
            </div>

            {/* Daily volume chart */}
            <Section title="Daily search volume" icon={TrendingUp}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.dailyVolume} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--ink-m)" }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "var(--ink-m)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12 }}
                    labelStyle={{ color: "var(--ink)" }}
                  />
                  <Bar dataKey="searches" fill="var(--navy)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

              {/* Top queries */}
              <Section title="Top queries" icon={Search}>
                {data.topQueries.length === 0 ? (
                  <p className="font-sans text-sm" style={{ color: "var(--ink-m)" }}>No data yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {data.topQueries.map((q, i) => (
                      <li key={q.query} className="flex items-center gap-3">
                        <span
                          className="font-data text-xs w-5 shrink-0 text-right"
                          style={{ color: "var(--ink-f)" }}
                        >
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-sans text-sm truncate"
                            style={{ color: "var(--ink)" }}
                          >
                            {q.query}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="font-data text-xs"
                            style={{ color: "var(--ink-m)" }}
                          >
                            {q.count}×
                          </span>
                          {q.zeroResultCount > 0 && (
                            <span
                              className="font-data text-[10px] px-1 py-0.5"
                              style={{ background: "#fef3c7", color: "#92400e" }}
                              title={`${q.zeroResultCount} times returned no results`}
                            >
                              {q.zeroResultCount} ∅
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>

              {/* Zero-result queries */}
              <Section title="Zero-result queries" icon={AlertCircle}>
                <p
                  className="font-sans text-xs mb-3"
                  style={{ color: "var(--ink-m)" }}
                >
                  Topics readers searched for but found nothing — content gaps.
                </p>
                {data.zeroResultQueries.length === 0 ? (
                  <p className="font-sans text-sm" style={{ color: "var(--ink-m)" }}>No zero-result queries.</p>
                ) : (
                  <ol className="space-y-2">
                    {data.zeroResultQueries.map((q, i) => (
                      <li key={q.query} className="flex items-center gap-3">
                        <span
                          className="font-data text-xs w-5 shrink-0 text-right"
                          style={{ color: "var(--ink-f)" }}
                        >
                          {i + 1}
                        </span>
                        <p
                          className="flex-1 font-sans text-sm truncate"
                          style={{ color: "var(--red, #ef4444)" }}
                        >
                          {q.query}
                        </p>
                        <span
                          className="font-data text-xs shrink-0"
                          style={{ color: "var(--ink-m)" }}
                        >
                          {q.count}×
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
