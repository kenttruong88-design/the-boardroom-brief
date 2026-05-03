"use client";

import { useState } from "react";
import { Heart, Reply, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Comment } from "@/app/api/comments/[articleId]/route";

export interface ExtendedComment extends Comment {
  _optimistic?: boolean;
  _pendingApproval?: boolean;
}

interface Props {
  comment: ExtendedComment;
  fingerprint: string;
  likedIds: Set<string>;
  onReply: (parentId: string) => void;
  onLike: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  depth: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function canEdit(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 5 * 60_000;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        flexShrink: 0,
        background: "var(--navy)",
        color: "var(--cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-jetbrains)",
        fontSize: "0.6rem",
        fontWeight: 600,
        letterSpacing: "0.05em",
      }}
    >
      {initials}
    </div>
  );
}

export default function CommentCard({ comment, fingerprint, likedIds, onReply, onLike, onDelete, depth }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isLiked = likedIds.has(comment.id);
  const isOwned = comment._optimistic || comment._pendingApproval;
  const showMenu = isOwned && onDelete;
  const replies = comment.replies ?? [];
  const COLLAPSE_THRESHOLD = 3;
  const [showAllReplies, setShowAllReplies] = useState(replies.length <= COLLAPSE_THRESHOLD);

  const visibleReplies = showAllReplies ? replies : replies.slice(0, COLLAPSE_THRESHOLD - 1);
  const hiddenCount = replies.length - visibleReplies.length;

  return (
    <div
      style={{
        paddingTop: 16,
        paddingBottom: depth === 0 ? 16 : 0,
        borderBottom: depth === 0 ? "1px solid var(--border)" : "none",
        opacity: comment._optimistic || comment._pendingApproval ? 0.75 : 1,
      }}
    >
      <div className="flex gap-3 items-start">
        <Initials name={comment.authorName} />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--navy)",
              }}
            >
              {comment.authorName}
            </span>
            <span style={{ color: "var(--border)" }}>·</span>
            <span
              style={{
                fontFamily: "var(--font-jetbrains)",
                fontSize: "0.65rem",
                color: "var(--ink-m)",
              }}
            >
              {timeAgo(comment.createdAt)}
            </span>

            {/* Pending badge */}
            {(comment._optimistic || comment._pendingApproval) && (
              <span
                style={{
                  fontFamily: "var(--font-jetbrains)",
                  fontSize: "0.6rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "2px 6px",
                  background: "rgba(184,150,12,0.12)",
                  color: "var(--gold)",
                  border: "1px solid rgba(184,150,12,0.3)",
                }}
              >
                Awaiting approval
              </span>
            )}
          </div>

          {/* Body */}
          {!collapsed && (
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.875rem",
                color: "var(--ink)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                marginBottom: 8,
              }}
            >
              {comment.body}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4">
            {/* Collapse toggle */}
            <button
              onClick={() => setCollapsed((v) => !v)}
              style={{
                fontFamily: "var(--font-jetbrains)",
                fontSize: "0.6rem",
                color: "var(--ink-m)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {collapsed ? "Expand" : "Collapse"}
            </button>

            {/* Like */}
            <button
              onClick={() => onLike(comment.id)}
              className="flex items-center gap-1"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                color: isLiked ? "var(--red)" : "var(--ink-m)",
              }}
              aria-label={isLiked ? "Unlike" : "Like"}
            >
              <Heart
                className="w-3.5 h-3.5"
                fill={isLiked ? "currentColor" : "none"}
                strokeWidth={isLiked ? 0 : 1.5}
              />
              {comment.likeCount > 0 && (
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains)",
                    fontSize: "0.65rem",
                  }}
                >
                  {comment.likeCount}
                </span>
              )}
            </button>

            {/* Reply — top-level only */}
            {depth === 0 && (
              <button
                onClick={() => onReply(comment.id)}
                className="flex items-center gap-1"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: "var(--ink-m)",
                }}
              >
                <Reply className="w-3.5 h-3.5" />
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains)",
                    fontSize: "0.65rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Reply
                </span>
              </button>
            )}

            {/* Menu */}
            {showMenu && (
              <div style={{ position: "relative", marginLeft: "auto" }}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 4px",
                    color: "var(--ink-m)",
                    display: "flex",
                    alignItems: "center",
                  }}
                  aria-label="Comment options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      background: "#fff",
                      border: "1px solid var(--border)",
                      minWidth: 140,
                      zIndex: 50,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  >
                    {canEdit(comment.createdAt) && (
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-gray-50"
                        style={{
                          fontFamily: "var(--font-dm-sans)",
                          fontSize: "0.8rem",
                          color: "var(--ink)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={() => setMenuOpen(false)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    )}
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-gray-50"
                      style={{
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: "0.8rem",
                        color: "var(--red)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete?.(comment.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Replies */}
          {!collapsed && replies.length > 0 && (
            <div
              style={{
                marginTop: 12,
                paddingLeft: 16,
                borderLeft: "2px solid var(--border)",
              }}
            >
              {visibleReplies.map((reply) => (
                <CommentCard
                  key={reply.id}
                  comment={reply}
                  fingerprint={fingerprint}
                  likedIds={likedIds}
                  onReply={onReply}
                  onLike={onLike}
                  onDelete={onDelete}
                  depth={1}
                />
              ))}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowAllReplies(true)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-jetbrains)",
                    fontSize: "0.65rem",
                    color: "var(--red)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "8px 0",
                  }}
                >
                  Show {hiddenCount} more {hiddenCount === 1 ? "reply" : "replies"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
