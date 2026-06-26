"use client";

import dynamic from "next/dynamic";

const CommentSection = dynamic(
  () => import("@/app/components/comments/CommentSection"),
  { ssr: false, loading: () => <div className="h-32" aria-hidden="true" /> }
);

interface Props {
  articleId: string;
  articleSlug: string;
  articleHeadline: string;
  initialCount: number;
}

export default function CommentSectionLoader(props: Props) {
  return <CommentSection {...props} />;
}
