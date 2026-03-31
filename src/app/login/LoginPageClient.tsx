"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => {
    const candidate = searchParams.get("next");
    return candidate && candidate.startsWith("/") ? candidate : "/";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="bg-card border-border shadow-card w-full max-w-md rounded-lg border p-5">
        <h1 className="text-foreground text-2xl font-semibold">DSP Project Intelligence</h1>
        <p className="text-muted-foreground mt-1 text-sm">Sign in with your email and password.</p>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-border text-foreground focus:ring-gold/30 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-border text-foreground focus:ring-gold/30 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
            />
          </div>

          {error && (
            <p className="text-status-critical bg-status-critical-bg rounded-md px-3 py-2 text-sm">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-gold rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Please wait..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
