"use client";

import { useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { events } from "@/app/lib/analytics";

interface Props {
  slug: string;
  section: string;
  articleId: string;
}

export default function ArticleReadTracker({ slug, section, articleId }: Props) {
  const sentRef = useRef(false);
  const posthog = usePostHog();

  useEffect(() => {
    if (sentRef.current) return;

    // Track 80% scroll as "article read complete"
    const sentinel = document.getElementById("article-end-sentinel");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !sentRef.current) {
          sentRef.current = true;

          // PostHog event
          posthog?.capture("article_read_complete", { slug, section, articleId });

          // Plausible event
          events.articleReadComplete(slug, section);

          // Increment article_views in Supabase via API
          fetch(`/api/articles/${articleId}/view`, { method: "POST" }).catch(() => {});

          observer.disconnect();
        }
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [slug, section, articleId, posthog]);

  return null;
}
