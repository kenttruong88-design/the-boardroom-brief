"use client";

import { useState } from "react";
import { Link2, MessageSquare, Share2 } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { events } from "@/app/lib/analytics";

interface Props {
  url: string;
  title: string;
  slug: string;
  /** "floating" = vertical sidebar, "inline" = horizontal row */
  variant?: "floating" | "inline";
}

export default function ShareButtons({ url, title, slug, variant = "floating" }: Props) {
  const posthog = usePostHog();
  const [copied, setCopied] = useState(false);

  function track(platform: string) {
    posthog?.capture("share_click", { slug, platform });
    events.shareClick(slug, platform);
  }

  function shareLinkedIn() {
    track("linkedin");
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=600"
    );
  }

  function shareTwitter() {
    track("twitter");
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=400"
    );
  }

  async function copyLink() {
    track("copy_link");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const btnClass =
    variant === "floating"
      ? "w-9 h-9 flex items-center justify-center border transition-colors hover:border-red-500 hover:text-red-500"
      : "p-2 border transition-colors hover:border-red-500 hover:text-red-500";

  const btnStyle = { border: "1px solid var(--border)", color: "var(--ink-m)", borderRadius: "2px" };

  return (
    <>
      <button onClick={shareLinkedIn} className={btnClass} style={btnStyle} title="Share on LinkedIn" aria-label="Share on LinkedIn">
        <Link2 className="w-4 h-4" />
      </button>
      <button onClick={shareTwitter} className={btnClass} style={btnStyle} title="Share on X / Twitter" aria-label="Share on X / Twitter">
        <MessageSquare className="w-4 h-4" />
      </button>
      <button onClick={copyLink} className={btnClass} style={btnStyle} title={copied ? "Copied!" : "Copy link"} aria-label="Copy link">
        <Share2 className="w-4 h-4" />
      </button>
    </>
  );
}
