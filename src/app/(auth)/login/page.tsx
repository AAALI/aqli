"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthStage } from "@/components/auth/AuthShell";
import * as analytics from "@/lib/analytics";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set by /auth/callback when a confirmation link is opened in a browser
  // without the signup session (PKCE verifier missing): the email is
  // confirmed, the user just needs to sign in to continue where they left off.
  const confirmed = searchParams.get("notice") === "confirmed";
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(next);
    });
  }, [router, next]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    if (data.user) {
      analytics.identify(data.user.id, { email });
      analytics.capture("user_logged_in", { email });
    }
    router.push(next);
    router.refresh();
  }

  return (
    <AuthStage>
      <form onSubmit={login}>
        <p className="ob-eb">Welcome back</p>
        <h1 className="ob-q">Sign in.</h1>
        <p className="ob-s">
          {confirmed ? "Email confirmed — sign in to finish setting up." : "Pick up where you left off."}
        </p>
        <div className="ob-f">
          <input className="inp lg" type="email" autoComplete="email" placeholder="you@company.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <input className="inp lg" type="password" autoComplete="current-password" placeholder="Password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="ob-err" role="alert">{error}</p>}
        <div className="ob-acts">
          <button type="submit" disabled={busy} className="btn btn-primary btn-lg">
            {busy ? "Signing in…" : "Sign in"}
            {!busy && <span className="kbd kbd-on-accent">⏎</span>}
          </button>
          <span className="ob-skip">
            New here? <Link href="/signup" style={{ color: "var(--accent)", textDecoration: "none" }}>Create a workspace</Link>
          </span>
        </div>
      </form>
    </AuthStage>
  );
}
