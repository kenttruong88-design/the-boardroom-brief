"use client";

import { useState, useRef, useEffect } from "react";
import { User, ChevronDown, Bookmark, Settings, LogOut, Crown } from "lucide-react";
import { createClient } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

interface UserMenuProps {
  email: string;
  plan: string;
  displayName?: string;
}

export default function UserMenu({ email, plan, displayName }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.refresh();
    setOpen(false);
  }

  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-sans transition-opacity hover:opacity-70"
        style={{ color: "var(--navy)" }}
      >
        <div
          className="w-7 h-7 flex items-center justify-center text-xs font-bold"
          style={{ background: "var(--navy)", color: "var(--cream)", borderRadius: "2px" }}
        >
          {initials}
        </div>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 z-50 py-1"
          style={{ background: "var(--cream)", border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}
        >
          {/* Account info */}
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-sans font-semibold truncate" style={{ color: "var(--navy)" }}>
              {displayName ?? email}
            </p>
            <p className="text-xs font-sans truncate mt-0.5" style={{ color: "var(--ink-m)" }}>
              {email}
            </p>
            <div className="mt-2 flex items-center gap-1">
              {plan === "premium" ? (
                <>
                  <Crown className="w-3 h-3" style={{ color: "var(--gold)" }} />
                  <span className="text-2xs font-mono" style={{ color: "var(--gold)" }}>Premium</span>
                </>
              ) : (
                <span className="text-2xs font-mono" style={{ color: "var(--ink-m)" }}>Free plan</span>
              )}
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <a
              href="/dashboard/bookmarks"
              className="flex items-center gap-2 px-4 py-2 text-sm font-sans transition-colors hover:opacity-70"
              style={{ color: "var(--ink)" }}
              onClick={() => setOpen(false)}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Bookmarks
            </a>
            <a
              href="/dashboard/settings"
              className="flex items-center gap-2 px-4 py-2 text-sm font-sans transition-colors hover:opacity-70"
              style={{ color: "var(--ink)" }}
              onClick={() => setOpen(false)}
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </a>
            {plan === "free" && (
              <a
                href="/subscribe"
                className="flex items-center gap-2 px-4 py-2 text-sm font-sans font-semibold transition-colors hover:opacity-70"
                style={{ color: "var(--red)" }}
                onClick={() => setOpen(false)}
              >
                <Crown className="w-3.5 h-3.5" />
                Upgrade to Premium
              </a>
            )}
          </div>

          <div className="border-t pt-1" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm font-sans transition-colors hover:opacity-70 text-left"
              style={{ color: "var(--ink-m)" }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
