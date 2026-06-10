"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthStage, AuthField, authInputStyle } from "@/components/auth/AuthShell";
import { IconMail } from "@/components/aqli/icons";
import posthog from "posthog-js";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/");
    });
  }, [router]);

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
      posthog.identify(data.user.id, { email });
      posthog.capture("user_logged_in", { email });
    }
    router.push("/");
    router.refresh();
  }

  return (
    <AuthStage
      ornament={
        <>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>Welcome back</div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 38, lineHeight: 1.1, letterSpacing: "-0.015em", color: "var(--text-primary)", textWrap: "balance" }}>
            The shared context layer for your team and its agents.
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 380 }}>
            Sign in to pick up where you left off. Drafts, review queues, and agent activity are all where you left them.
          </p>
          <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 999, fontSize: 12, color: "var(--text-secondary)", width: "fit-content" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent)" }} />
            <span>3 docs awaiting your review</span>
          </div>
        </>
      }
    >
      <form onSubmit={login} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 28, letterSpacing: "-0.015em" }}>Sign in</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>Use your workspace email.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AuthField label="Email">
            <span style={authInputStyle()}>
              <span style={{ color: "var(--text-muted)", display: "flex" }}><IconMail size={14} /></span>
              <input type="email" placeholder="you@team.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "var(--text-primary)", fontFamily: "inherit" }} />
            </span>
          </AuthField>
          <AuthField label="Password" trailing={<span style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 500, cursor: "pointer" }}>Forgot?</span>}>
            <span style={authInputStyle()}>
              <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "var(--text-primary)", fontFamily: "inherit" }} />
            </span>
          </AuthField>
          {error && <p style={{ margin: 0, fontSize: 13, color: "#993C1D" }}>{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: "100%", height: 40, justifyContent: "center", marginTop: 6 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", textAlign: "center" }}>
          New here?{" "}
          <Link href="/signup" style={{ color: "var(--accent)", fontWeight: 500 }}>Create a workspace</Link>
        </div>
      </form>
    </AuthStage>
  );
}
