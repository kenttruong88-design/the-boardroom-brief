"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/app/lib/supabase";
import type { Comment } from "@/app/api/comments/[articleId]/route";
import CommentCard, { type ExtendedComment } from "./CommentCard";
import ReplyForm from "./ReplyForm";

type SortOrder = "best" | "newest" | "oldest";

interface Props {
  articleId: string;
  articleSlug: string;
  articleHeadline: string;
  initialCount?: number;
}

const LIKED_KEY = "tbb_likes";
const FP_KEY = "tbb_fp";
const PAGE_SIZE = 20;

function getFingerprint(): string {
  if (typeof window === "undefined") return "";
  let fp = localStorage.getItem(FP_KEY);
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem(FP_KEY, fp);
  }
  return fp;
}

function getLikedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveLikedSet(set: Set<string>) {
  localStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
}

function SortButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 10px",
        border: "1px solid var(--border)",
        background: active ? "var(--navy)" : "transparent",
        color: active ? "var(--cream)" : "var(--ink-m)",
        fontFamily: "var(--font-jetbrains)",
        fontSize: "0.6rem",
        textTransform: "uppercase" as const,
        letterSpacing: "0.07em",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
    >
      {label}
    </button>
  );
}

export default function CommentSection({ articleId, articleHeadline, initialCount }: Props) {
  const [comments, setComments] = useState<ExtendedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOrder>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Init client-side values
  useEffect(() => {
    setFingerprint(getFingerprint());
    setLikedIds(getLikedSet());
  }, []);

  // Auth state
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? "" });
        const name =
          (data.user.user_metadata?.full_name as string | undefined) ??
          (data.user.user_metadata?.name as string | undefined) ??
          "";
        setAuthorName(name);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? "" });
        const name =
          (session.user.user_metadata?.full_name as string | undefined) ??
          (session.user.user_metadata?.name as string | undefined) ??
          "";
        setAuthorName(name);
      } else {
        setUser(null);
        setAuthorName("");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(articleId)}`);
      const data = (await res.json()) as { comments?: Comment[] };
      setComments(data.comments ?? []);
    } catch {
      // keep existing comments
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`comments-${articleId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `article_id=eq.${articleId}`,
        },
        (payload: {
          new: {
            id: string;
            article_id: string;
            parent_id: string | null;
            author_name: string;
            body: string;
            like_count: number;
            created_at: string;
            status: string;
            deleted_at: string | null;
          };
        }) => {
          const row = payload.new;
          if (row.status !== "approved" || row.deleted_at) return;
          setComments((prev) => {
            if (prev.some((c) => c.id === row.id)) return prev;
            const mapped: ExtendedComment = {
              id: row.id,
              articleId: row.article_id,
              parentId: row.parent_id,
              authorName: row.author_name,
              body: row.body,
              likeCount: row.like_count ?? 0,
              createdAt: row.created_at,
              replies: [],
            };
            // If it's a reply, nest it; otherwise prepend
            if (mapped.parentId) {
              return prev.map((c) =>
                c.id === mapped.parentId
                  ? { ...c, replies: [...(c.replies ?? []), mapped] }
                  : c
              );
            }
            return [mapped, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [articleId]);

  // Sort & paginate
  const topLevel = comments.filter((c) => !c.parentId);
  const approvedTopLevel = topLevel.filter((c) => !c._optimistic && !c._pendingApproval);
  // Use server-rendered count until first client fetch resolves
  const displayCount = loading ? (initialCount ?? 0) : approvedTopLevel.length;

  const sorted = [...topLevel].sort((a, b) => {
    if (sort === "best") return b.likeCount - a.likeCount;
    if (sort === "newest")
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const visible = sorted.slice(0, visibleCount);

  // Submit top-level comment
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !authorName.trim()) return;
    setSubmitting(true);
    setSubmitError("");

    const savedBody = body;
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: ExtendedComment = {
      id: optimisticId,
      articleId,
      parentId: null,
      authorName,
      body: savedBody,
      likeCount: 0,
      createdAt: new Date().toISOString(),
      replies: [],
      _optimistic: true,
    };
    setComments((prev) => [optimistic, ...prev]);
    setBody("");

    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(articleId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName,
          authorEmail: user?.email ?? `guest@tbb`,
          body: savedBody,
          articleTitle: articleHeadline,
        }),
      });

      const data = (await res.json()) as { id?: string; status?: string; error?: string };

      if (!res.ok || !data.id) {
        setComments((prev) => prev.filter((c) => c.id !== optimisticId));
        setBody(savedBody);
        setSubmitError(data.error ?? "Failed to post. Please try again.");
        return;
      }

      // Replace optimistic entry with confirmed one
      const confirmed: ExtendedComment = {
        ...optimistic,
        id: data.id,
        _optimistic: false,
        _pendingApproval: data.status !== "approved",
      };
      setComments((prev) =>
        prev.map((c) => (c.id === optimisticId ? confirmed : c))
      );
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
      setBody(savedBody);
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Like toggle
  async function handleLike(commentId: string) {
    const wasLiked = likedIds.has(commentId);
    // Optimistic update
    const next = new Set(likedIds);
    if (wasLiked) next.delete(commentId);
    else next.add(commentId);
    setLikedIds(next);
    saveLikedSet(next);

    setComments((prev) =>
      prev.map((c) => {
        const updateCount = (comment: ExtendedComment): ExtendedComment => ({
          ...comment,
          likeCount: comment.likeCount + (wasLiked ? -1 : 1),
        });
        if (c.id === commentId) return updateCount(c);
        if (c.replies?.some((r) => r.id === commentId)) {
          return {
            ...c,
            replies: c.replies!.map((r) =>
              r.id === commentId ? updateCount(r) : r
            ),
          };
        }
        return c;
      })
    );

    try {
      await fetch(
        `/api/comments/${encodeURIComponent(articleId)}/${commentId}/like`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fingerprint }),
        }
      );
    } catch {
      // Revert on error
      setLikedIds(likedIds);
      saveLikedSet(likedIds);
      setComments((prev) =>
        prev.map((c) => {
          const revert = (comment: ExtendedComment): ExtendedComment => ({
            ...comment,
            likeCount: comment.likeCount - (wasLiked ? -1 : 1),
          });
          if (c.id === commentId) return revert(c);
          if (c.replies?.some((r) => r.id === commentId)) {
            return {
              ...c,
              replies: c.replies!.map((r) =>
                r.id === commentId ? revert(r) : r
              ),
            };
          }
          return c;
        })
      );
    }
  }

  // Delete (only optimistic / own comments)
  function handleDelete(commentId: string) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  // Auto-resize textarea
  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }

  function handleSignIn() {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }

  return (
    <section
      style={{
        marginTop: "3rem",
        paddingTop: "2rem",
        borderTop: "2px solid var(--navy)",
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <MessageSquare
            className="w-4 h-4"
            style={{ color: "var(--navy)" }}
          />
          <h2
            className="font-serif font-bold"
            style={{ fontSize: "1.1rem", color: "var(--navy)" }}
          >
            {displayCount} {displayCount === 1 ? "comment" : "comments"}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <SortButton
            label="Best"
            active={sort === "best"}
            onClick={() => setSort("best")}
          />
          <SortButton
            label="Newest"
            active={sort === "newest"}
            onClick={() => setSort("newest")}
          />
          <SortButton
            label="Oldest"
            active={sort === "oldest"}
            onClick={() => setSort("oldest")}
          />
        </div>
      </div>

      {/* ── Comment form ── */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-3 items-start">
            {/* Avatar */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                flexShrink: 0,
                background: "var(--navy)",
                color: "var(--cream)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-jetbrains)",
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              {authorName
                ? authorName.slice(0, 2).toUpperCase()
                : user.email.slice(0, 2).toUpperCase()}
            </div>

            <div className="flex-1">
              {/* Name input if no display name */}
              {!authorName && (
                <input
                  type="text"
                  placeholder="Your display name"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  required
                  className="w-full text-sm font-sans px-3 py-2 mb-2"
                  style={{
                    border: "1px solid var(--border)",
                    background: "#fff",
                    color: "var(--navy)",
                    outline: "none",
                  }}
                />
              )}

              {/* Textarea */}
              <div style={{ position: "relative" }}>
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={handleBodyChange}
                  placeholder="Add to the discussion…"
                  required
                  rows={3}
                  style={{
                    width: "100%",
                    minHeight: 80,
                    resize: "none",
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "#fff",
                    color: "var(--navy)",
                    padding: "10px 12px",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "0.875rem",
                    outline: "none",
                    lineHeight: 1.6,
                  }}
                />
                {body.length > 1800 && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 10,
                      fontFamily: "var(--font-jetbrains)",
                      fontSize: "0.6rem",
                      color: body.length > 1950 ? "var(--red)" : "var(--ink-m)",
                    }}
                  >
                    {body.length}/2000
                  </span>
                )}
              </div>

              {submitError && (
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "0.78rem",
                    color: "var(--red)",
                    marginTop: 6,
                  }}
                >
                  {submitError}
                </p>
              )}

              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={submitting || !body.trim() || body.length > 2000}
                  className="btn-navy"
                  style={{
                    fontSize: "0.8rem",
                    padding: "6px 18px",
                    opacity:
                      submitting || !body.trim() ? 0.5 : 1,
                  }}
                >
                  {submitting ? "Posting…" : "Post comment"}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div
          className="mb-8 flex items-center justify-between"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "14px 16px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.875rem",
              color: "var(--ink-m)",
            }}
          >
            Sign in to join the discussion
          </span>
          <button
            onClick={handleSignIn}
            className="btn-navy"
            style={{ fontSize: "0.8rem", padding: "6px 16px" }}
          >
            Sign in
          </button>
        </div>
      )}

      {/* ── Comment list ── */}
      {loading ? (
        <div
          style={{
            color: "var(--ink-m)",
            fontFamily: "var(--font-jetbrains)",
            fontSize: "0.7rem",
            textAlign: "center",
            padding: "3rem 0",
            letterSpacing: "0.05em",
          }}
        >
          Loading comments…
        </div>
      ) : visible.length === 0 ? (
        <div
          style={{
            color: "var(--ink-m)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.875rem",
            textAlign: "center",
            padding: "3rem 0",
            fontStyle: "italic",
          }}
        >
          No comments yet. Be the first.
        </div>
      ) : (
        <div>
          {visible.map((comment) => (
            <div key={comment.id}>
              <CommentCard
                comment={comment}
                currentUserId={user?.id}
                fingerprint={fingerprint}
                likedIds={likedIds}
                onLike={handleLike}
                onReply={(parentId) =>
                  setReplyTarget(
                    replyTarget === parentId ? null : parentId
                  )
                }
                onDelete={handleDelete}
                depth={0}
              />
              {replyTarget === comment.id && (
                <div style={{ paddingLeft: 44, marginBottom: 8 }}>
                  <ReplyForm
                    parentId={comment.id}
                    parentAuthorName={comment.authorName}
                    articleId={articleId}
                    articleHeadline={articleHeadline}
                    user={user}
                    authorName={authorName || (user?.email ?? "")}
                    onSubmit={(reply) => {
                      setComments((prev) =>
                        prev.map((c) =>
                          c.id === comment.id
                            ? {
                                ...c,
                                replies: [...(c.replies ?? []), reply],
                              }
                            : c
                        )
                      );
                      setReplyTarget(null);
                    }}
                    onCancel={() => setReplyTarget(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Load more ── */}
      {sorted.length > visibleCount && (
        <div className="text-center mt-6">
          <button
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="btn-outline"
            style={{ fontSize: "0.8rem" }}
          >
            Load more comments
          </button>
        </div>
      )}
    </section>
  );
}
