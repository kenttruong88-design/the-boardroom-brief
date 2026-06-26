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

  // Fire article_view once on mount
  useEffect(() => {
    posthog?.capture("article_view", { slug, section, articleId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sentRef.current) return;

    const sentinel = document.getElementById("article-end-sentinel");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !sentRef.current) {
          sentRef.current = true;

          posthog?.capture("article_read_complete", { slug, section, articleId });
          events.articleReadComplete(slug, section);
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
