"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const PILLARS = [
  { slug: "markets-floor",  name: "Markets Floor"  },
  { slug: "macro-mondays",  name: "Macro Mondays"  },
  { slug: "c-suite-circus", name: "C-Suite Circus" },
  { slug: "global-office",  name: "Global Office"  },
  { slug: "water-cooler",   name: "Water Cooler"   },
  { slug: "off-the-record", name: "Off the Record" },
];

const ECONOMIES = [
  // Americas
  { slug: "united-states",  name: "United States"  },
  { slug: "canada",         name: "Canada"         },
  { slug: "mexico",         name: "Mexico"         },
  { slug: "brazil",         name: "Brazil"         },
  { slug: "argentina",      name: "Argentina"      },
  { slug: "colombia",       name: "Colombia"       },
  // Europe
  { slug: "united-kingdom", name: "United Kingdom" },
  { slug: "germany",        name: "Germany"        },
  { slug: "france",         name: "France"         },
  { slug: "italy",          name: "Italy"          },
  { slug: "spain",          name: "Spain"          },
  { slug: "netherlands",    name: "Netherlands"    },
  { slug: "switzerland",    name: "Switzerland"    },
  { slug: "sweden",         name: "Sweden"         },
  // Middle East
  { slug: "saudi-arabia",   name: "Saudi Arabia"   },
  { slug: "uae",            name: "UAE"            },
  { slug: "turkey",         name: "Turkey"         },
  // Africa
  { slug: "south-africa",   name: "South Africa"   },
  { slug: "nigeria",        name: "Nigeria"        },
  { slug: "egypt",          name: "Egypt"          },
  // Asia-Pacific
  { slug: "japan",          name: "Japan"          },
  { slug: "china",          name: "China"          },
  { slug: "india",          name: "India"          },
  { slug: "south-korea",    name: "South Korea"    },
  { slug: "australia",      name: "Australia"      },
  { slug: "singapore",      name: "Singapore"      },
  { slug: "indonesia",      name: "Indonesia"      },
  { slug: "thailand",       name: "Thailand"       },
  { slug: "taiwan",         name: "Taiwan"         },
  { slug: "malaysia",       name: "Malaysia"       },
];

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  segments: string[] | null;
  economies: string[] | null;
  frequency: string | null;
}

interface Props {
  subscriber: Subscriber;
  token: string;
}

export default function PreferencesForm({ subscriber, token }: Props) {
  const allSegments = subscriber.segments?.includes("all") || !subscriber.segments?.length;

  const [firstName, setFirstName] = useState(subscriber.first_name ?? "");
  const [segments, setSegments] = useState<string[]>(
    allSegments ? PILLARS.map((p) => p.slug) : (subscriber.segments ?? [])
  );
  const [allEconomies, setAllEconomies] = useState(!subscriber.economies?.length);
  const [economies, setEconomies] = useState<string[]>(subscriber.economies ?? []);
  const [frequency, setFrequency] = useState(subscriber.frequency ?? "daily");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function toggleSegment(slug: string) {
    setSegments((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function toggleEconomy(slug: string) {
    setEconomies((prev) =>
      prev.includes(slug) ? prev.filter((e) => e !== slug) : [...prev, slug]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch("/api/newsletter/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          firstName: firstName.trim() || undefined,
          segments: segments.length > 0 ? segments : ["all"],
          economies: allEconomies ? [] : economies,
          frequency,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Save failed. Please try again.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const eyebrow = "font-body text-xs font-bold tracking-widest uppercase text-red-500 mb-1";
  const hint = "font-body text-sm text-ink-muted dark:text-cream-300";
  const checkLabel = "flex items-center gap-2.5 cursor-pointer font-body text-sm text-ink dark:text-cream-100";
  const sectionClass = "p-6 border-b border-rule dark:border-rule-dark";

  return (
    <form onSubmit={handleSave}>
      <div className="border border-rule dark:border-rule-dark bg-cream-200 dark:bg-navy-400 overflow-hidden">

        {/* Content preferences */}
        <div className={sectionClass}>
          <p className={eyebrow}>Content preferences</p>
          <p className={`${hint} mb-5`}>Which sections do you want in your Morning Brief?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PILLARS.map((pillar) => (
              <label key={pillar.slug} className={checkLabel}>
                <input
                  type="checkbox"
                  checked={segments.includes(pillar.slug)}
                  onChange={() => toggleSegment(pillar.slug)}
                  className="w-4 h-4 accent-red-500"
                />
                {pillar.name}
              </label>
            ))}
          </div>
        </div>

        {/* Economy focus */}
        <div className={sectionClass}>
          <p className={eyebrow}>Economy focus</p>
          <p className={`${hint} mb-4`}>Which economies matter most to you?</p>

          <label className={`${checkLabel} mb-4 pb-4 border-b border-rule dark:border-rule-dark`}>
            <input
              type="checkbox"
              checked={allEconomies}
              onChange={() => setAllEconomies((v) => !v)}
              className="w-4 h-4 accent-red-500"
            />
            <span className="font-semibold text-navy-500 dark:text-cream-100">All economies</span>
          </label>

          {!allEconomies && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ECONOMIES.map((economy) => (
                <label key={economy.slug} className={checkLabel}>
                  <input
                    type="checkbox"
                    checked={economies.includes(economy.slug)}
                    onChange={() => toggleEconomy(economy.slug)}
                    className="w-4 h-4 accent-red-500"
                  />
                  {economy.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Frequency */}
        <div className={sectionClass}>
          <p className={eyebrow}>Frequency</p>
          <p className={`${hint} mb-4`}>How often would you like to receive the Brief?</p>
          <div className="space-y-3">
            {[
              { value: "daily",  label: "Daily",          desc: "Monday to Friday" },
              { value: "weekly", label: "Weekly digest",   desc: "Fridays only"    },
            ].map((opt) => (
              <label key={opt.value} className={checkLabel}>
                <input
                  type="radio"
                  name="frequency"
                  value={opt.value}
                  checked={frequency === opt.value}
                  onChange={() => setFrequency(opt.value)}
                  className="w-4 h-4 accent-red-500"
                />
                <span>
                  <strong>{opt.label}</strong>
                  <span className="text-ink-muted dark:text-cream-300"> — {opt.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Personal */}
        <div className="p-6">
          <p className={eyebrow}>Personal</p>
          <p className={`${hint} mb-4`}>Used to personalise your morning greeting.</p>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name (optional)"
            className="w-full sm:w-64 font-body text-sm px-4 py-2.5 outline-none bg-cream-100 dark:bg-navy-500 border border-rule dark:border-rule-dark text-ink dark:text-cream-100 placeholder:text-ink-faint dark:placeholder:text-cream-500"
          />
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center gap-4 mt-6">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 font-body text-xs font-bold tracking-widest uppercase px-5 py-2.5 bg-red-500 text-cream-100 hover:bg-navy-500 dark:hover:bg-cream-200 dark:hover:text-navy-500 transition-colors duration-[120ms] disabled:opacity-60"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : (
            "Save preferences"
          )}
        </button>

        {saved && (
          <span className="flex items-center gap-1.5 font-body text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </span>
        )}

        {error && (
          <span className="font-body text-sm text-red-500">{error}</span>
        )}
      </div>
    </form>
  );
}
