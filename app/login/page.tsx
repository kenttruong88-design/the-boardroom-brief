"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/app/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/editorial";

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(next);
    });
  }, [router, next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      router.replace(next);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--cream)" }}
    >
      <div className="w-full max-w-sm">
        {/* Masthead */}
        <div className="text-center mb-10">
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "var(--ink-m)" }}>
            The Boardroom Brief
          </p>
          <h1 className="text-2xl font-serif font-bold" style={{ color: "var(--navy)" }}>
            Editorial Access
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              className="block text-xs font-sans font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: "var(--ink-m)" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 text-sm font-sans"
              style={{
                background: "#fff",
                border: "1px solid var(--border)",
                color: "var(--navy)",
                outline: "none",
              }}
            />
          </div>

          <div className="mb-6">
            <label
              className="block text-xs font-sans font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: "var(--ink-m)" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm font-sans"
              style={{
                background: "#fff",
                border: "1px solid var(--border)",
                color: "var(--navy)",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <p className="text-sm font-sans mb-4" style={{ color: "var(--red)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-sans font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--navy)", color: "var(--cream)" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
