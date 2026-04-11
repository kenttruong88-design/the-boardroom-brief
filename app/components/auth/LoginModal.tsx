"use client";

import { useState } from "react";
import { X, Mail, Link2, Globe } from "lucide-react";
import { createClient } from "@/app/lib/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const supabase = createClient();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  async function handleOAuth(provider: "linkedin_oidc" | "google") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,25,35,0.75)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-md p-8"
        style={{ background: "var(--cream)", border: "1px solid var(--border)" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 transition-opacity hover:opacity-60"
          style={{ color: "var(--ink-m)" }}
        >
          <X className="w-4 h-4" />
        </button>

        {!sent ? (
          <>
            <p className="eyebrow-gold mb-1" style={{ color: "var(--gold)" }}>
              The Alignment Times
            </p>
            <h2 className="text-2xl font-serif font-bold mb-1" style={{ color: "var(--navy)" }}>
              Sign in
            </h2>
            <p className="text-sm font-sans mb-6" style={{ color: "var(--ink-m)" }}>
              Free access to all coverage. No password required.
            </p>

            {/* Magic link form */}
            <form onSubmit={handleMagicLink} className="space-y-3 mb-6">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full text-sm font-sans px-4 py-3 outline-none"
                  style={{
                    background: "white",
                    border: "1px solid var(--border)",
                    color: "var(--ink)",
                    borderRadius: "2px",
                  }}
                />
              </div>
              {error && (
                <p className="text-xs" style={{ color: "var(--red)" }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="btn-navy w-full flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {loading ? "Sending…" : "Continue with email"}
              </button>
            </form>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="text-xs font-sans" style={{ color: "var(--ink-m)" }}>or</span>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            </div>

            {/* OAuth */}
            <div className="space-y-2">
              <button
                onClick={() => handleOAuth("google")}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-sans transition-opacity hover:opacity-80"
                style={{ border: "1px solid var(--border)", color: "var(--ink)", borderRadius: "2px" }}
              >
                <Globe className="w-4 h-4" />
                Continue with Google
              </button>
              <button
                onClick={() => handleOAuth("linkedin_oidc")}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-sans transition-opacity hover:opacity-80"
                style={{ border: "1px solid var(--border)", color: "var(--ink)", borderRadius: "2px" }}
              >
                <Link2 className="w-4 h-4" />
                Continue with LinkedIn
              </button>
            </div>

            <p className="text-xs font-sans text-center mt-6" style={{ color: "var(--ink-m)" }}>
              By continuing you agree to our{" "}
              <a href="/terms" className="underline hover:opacity-70">Terms</a> and{" "}
              <a href="/privacy" className="underline hover:opacity-70">Privacy Policy</a>.
            </p>
          </>
        ) : (
          <div className="text-center py-4">
            <div
              className="w-12 h-12 flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--navy)", borderRadius: "2px" }}
            >
              <Mail className="w-6 h-6" style={{ color: "var(--cream)" }} />
            </div>
            <h2 className="text-xl font-serif font-bold mb-2" style={{ color: "var(--navy)" }}>
              Check your inbox
            </h2>
            <p className="text-sm font-sans" style={{ color: "var(--ink-m)" }}>
              We sent a sign-in link to <strong>{email}</strong>. Click it to access your account.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="mt-6 text-sm font-sans underline hover:opacity-70"
              style={{ color: "var(--ink-m)" }}
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
