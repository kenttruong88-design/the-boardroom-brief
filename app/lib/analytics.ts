// Plausible custom events — fire-and-forget, no PII
declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number> }) => void;
  }
}

export function trackEvent(event: string, props?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  window.plausible?.(event, props ? { props } : undefined);
}

export const events = {
  newsletterSignup: (location: string) =>
    trackEvent("newsletter_signup", { location }),

  articleReadComplete: (slug: string, section: string) =>
    trackEvent("article_read_complete", { slug, section }),

  paywallHit: (slug: string) =>
    trackEvent("paywall_hit", { slug }),

  shareClick: (slug: string, platform: string) =>
    trackEvent("share_click", { slug, platform }),
};
