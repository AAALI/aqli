"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthStage, AuthField, authInputStyle } from "@/components/auth/AuthShell";
import { IconMail } from "@/components/aqli/icons";

const fieldInput: React.CSSProperties = { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "var(--text-primary)", fontFamily: "inherit" };

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // When a user is already signed in (e.g. came from /signup?step=workspace),
  // we only need the workspace name.
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
  }, [supabase]);

  async function createWorkspace() {
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: workspaceName }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Could not create workspace");
    }
    const { workspace } = await res.json();
    router.push(`/w/${workspace.slug}`);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (!loggedIn) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (!data.session) {
          setNotice(
            "Account created. Check your email to confirm, then log in to finish setup.",
          );
          setBusy(false);
          return;
        }
      }
      await createWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <AuthStage
      ornament={
        <>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>Get started</div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 38, lineHeight: 1.1, letterSpacing: "-0.015em", color: "var(--text-primary)", textWrap: "balance" }}>
            One shared brain for your humans and your agents.
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 380 }}>
            Humans write docs. Agents read context and draft output. Humans review and approve. Aqli keeps everyone working from the same source of truth.
          </p>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 28, letterSpacing: "-0.015em" }}>
            {loggedIn ? "Name your workspace" : "Create a workspace"}
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>
            {loggedIn ? "This is the shared layer your team and agents will share." : "Start your team's shared context layer in seconds."}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AuthField label="Workspace name">
            <span style={authInputStyle()}>
              <input placeholder="e.g. Tabadulat" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} required style={fieldInput} />
            </span>
          </AuthField>
          {!loggedIn && (
            <>
              <AuthField label="Email">
                <span style={authInputStyle()}>
                  <span style={{ color: "var(--text-muted)", display: "flex" }}><IconMail size={14} /></span>
                  <input type="email" placeholder="you@team.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={fieldInput} />
                </span>
              </AuthField>
              <AuthField label="Password">
                <span style={authInputStyle()}>
                  <input type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required style={fieldInput} />
                </span>
              </AuthField>
            </>
          )}
          {error && <p style={{ margin: 0, fontSize: 13, color: "#993C1D" }}>{error}</p>}
          {notice && <p style={{ margin: 0, fontSize: 13, color: "var(--approved-text)" }}>{notice}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: "100%", height: 40, justifyContent: "center", marginTop: 6 }}>
            {busy ? "Creating…" : "Create workspace"}
          </button>
        </div>
        {!loggedIn && (
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", textAlign: "center" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--accent)", fontWeight: 500 }}>Sign in</Link>
          </div>
        )}
      </form>
    </AuthStage>
  );
}
