"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import posthog from "posthog-js";

const CONSENT_KEY = "tbb-cookie-consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(CONSENT_KEY) === null) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    posthog.opt_in_capturing();
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, "declined");
    posthog.opt_out_capturing();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t-2 border-navy-500 dark:border-cream-200 bg-cream-100 dark:bg-navy-500">
      <div className="site-container py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="flex-1 font-body text-sm text-ink dark:text-cream-100">
          We use cookies and analytics to understand how you use The Alignment Times.{" "}
          <Link href="/cookies" className="underline text-red-500 hover:text-navy-500 dark:hover:text-cream-300 transition-colors duration-[120ms]">
            Cookie policy
          </Link>
          .
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={decline}
            className="font-body text-xs font-bold tracking-widest uppercase px-4 py-2 border border-navy-500 dark:border-cream-300 text-navy-500 dark:text-cream-100 hover:bg-navy-500 hover:text-cream-100 dark:hover:bg-cream-200 dark:hover:text-navy-500 transition-colors duration-[120ms]"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="font-body text-xs font-bold tracking-widest uppercase px-4 py-2 bg-red-500 text-cream-100 hover:bg-navy-500 dark:hover:bg-cream-200 dark:hover:text-navy-500 transition-colors duration-[120ms]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
