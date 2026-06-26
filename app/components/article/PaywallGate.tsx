"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { events } from "@/app/lib/analytics";

interface Props {
  slug: string;
}

export default function PaywallGate({ slug }: Props) {
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture("paywall_hit", { slug });
    events.paywallHit(slug);
  }, [slug, posthog]);

  return (
    <div className="border-t pt-10 mt-10" style={{ borderColor: "var(--border)" }}>
      <div className="p-10 text-center" style={{ background: "var(--navy)" }}>
        <p className="eyebrow-gold mb-3" style={{ color: "var(--gold)" }}>Subscriber Only</p>
        <h3 className="text-xl font-serif font-bold mb-3" style={{ color: "var(--cream)" }}>
          Continue reading — it&apos;s free
        </h3>
        <p className="text-sm font-sans mb-6" style={{ color: "rgba(245,240,232,0.6)" }}>
          Subscribe to The Alignment Times and get every article delivered to your inbox.
        </p>
        <div className="flex justify-center">
          <Link href="/subscribe" className="btn-red">Subscribe free</Link>
        </div>
      </div>
    </div>
  );
}
