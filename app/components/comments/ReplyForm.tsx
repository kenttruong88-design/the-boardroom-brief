"use client";

import { useState, useRef, useEffect } from "react";
import type { ExtendedComment } from "./CommentCard";

interface Props {
  parentId: string;
  parentAuthorName: string;
  articleId: string;
  articleHeadline: string;
  user: { id: string; email: string } | null;
  authorName: string;
  onSubmit: (reply: ExtendedComment) => void;
  onCancel: () => void;
}

export default function ReplyForm({
  parentId,
  parentAuthorName,
  articleId,
  articleHeadline,
  user,
  authorName,
  onSubmit,
  onCancel,
}: Props) {
  const mention = `@${parentAuthorName} `;
  const [body, setBody] = useState(mention);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    // Don't let user delete the @mention prefix
    if (!val.startsWith(mention)) {
      setBody(mention);
      return;
    }
    setBody(val);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || trimmed === mention.trim()) return;
    setError("");
    setSubmitting(true);

    const optimisticReply: ExtendedComment = {
      id: `opt-reply-${Date.now()}`,
      articleId,
      parentId,
      authorName,
      body: trimmed,
      likeCount: 0,
      createdAt: new Date().toISOString(),
      replies: [],
      _optimistic: true,
    };

    // Optimistically add reply immediately
    onSubmit(optimisticReply);

    try {
      const res = await fetch(`/api/comments/${articleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName,
          authorEmail: user?.email ?? `${authorName.toLowerCase().replace(/\s+/g, ".")}@guest.tbb`,
          body: trimmed,
          parentId,
          articleTitle: articleHeadline,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Failed to post reply.");
      }
      // The optimistic reply stays; realtime or next refresh will confirm
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: "12px",
        marginTop: 8,
      }}
    >
      <textarea
        ref={textareaRef}
        value={body}
        onChange={handleChange}
        rows={2}
        style={{
          width: "100%",
          minHeight: 64,
          resize: "none",
          overflow: "hidden",
          background: "#fff",
          border: "1px solid var(--border)",
          color: "var(--navy)",
          padding: "8px 10px",
          fontFamily: "var(--font-dm-sans)",
          fontSize: "0.8rem",
          outline: "none",
          lineHeight: 1.5,
        }}
      />

      {body.length > 1800 && (
        <div
          style={{
            fontFamily: "var(--font-jetbrains)",
            fontSize: "0.6rem",
            color: body.length > 1950 ? "var(--red)" : "var(--ink-m)",
            textAlign: "right",
            marginTop: 4,
          }}
        >
          {body.length}/2000
        </div>
      )}

      {error && (
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.75rem",
            color: "var(--red)",
            marginTop: 6,
          }}
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            color: "var(--ink-m)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.75rem",
            padding: "5px 12px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || body.trim() === mention.trim() || body.length > 2000}
          className="btn-navy"
          style={{
            fontSize: "0.75rem",
            padding: "5px 14px",
            opacity:
              submitting || body.trim() === mention.trim() ? 0.5 : 1,
          }}
        >
          {submitting ? "Posting…" : "Post reply"}
        </button>
      </div>
    </form>
  );
}
