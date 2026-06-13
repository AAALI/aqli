"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthStage, AuthField, authInputStyle } from "@/components/auth/AuthShell";
import { IconMail, IconCheck, IconX, IconArrowUpRight } from "@/components/aqli/icons";
import type { InvitationDetails, Role } from "@/types/invitation";
import posthog from "posthog-js";

const fieldInput: React.CSSProperties = { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "var(--text-primary)", fontFamily: "inherit" };

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", editor: "Editor", viewer: "Viewer" };
const ROLE_PERMS: Record<Role, string[]> = {
  admin: ["Read and write docs in every Space", "Approve or request changes to any doc", "Manage members, settings, and API keys"],
  editor: ["Read and write docs in every Space", "Approve or request changes to any doc", "Use AI search and Ask"],
  viewer: ["Read every doc in the workspace", "Use AI search and Ask", "Cannot write or approve docs"],
};

type Mode = "signup" | "signin";

export default function InviteClient() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const supabase = createClient();

  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(
    token ? null : "This invite link is missing its token.",
  );
  const [loading, setLoading] = useState(Boolean(token));
  const [signedIn, setSignedIn] = useState(false);

  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const [{ data: detData, error: detErr }, { data: userData }] = await Promise.all([
        supabase.rpc("invitation_details", { p_token: token }),
        supabase.auth.getUser(),
      ]);
      const row = (detData as InvitationDetails[] | null)?.[0] ?? null;
      if (detErr || !row) {
        setLoadError("This invite link is invalid or no longer exists.");
      } else if (row.status !== "pending") {
        setLoadError(row.status === "accepted" ? "This invitation has already been accepted." : "This invitation has been revoked.");
        setDetails(row);
      } else if (row.expired) {
        setLoadError("This invitation has expired. Ask an admin to send a new one.");
        setDetails(row);
      } else {
        setDetails(row);
        if (!userData.user) setEmail(row.email);
      }
      if (userData.user) {
        setSignedIn(true);
        setEmail(userData.user.email ?? row?.email ?? "");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
      if (error) throw error;
      const slug = (data as string) || details?.workspace_slug;
      posthog.capture("invitation_accepted", { workspace_slug: slug });
      router.push(slug ? `/w/${slug}` : "/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join the workspace");
      setBusy(false);
    }
  }

  async function authThenAccept(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setNotice("Account created. Confirm your email, then reopen this invite link to join.");
          setBusy(false);
          return;
        }
        posthog.identify(data.user!.id, { email });
        posthog.capture("user_signed_up", { email, via: "invite" });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) posthog.identify(data.user.id, { email });
      }
      await accept();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  const ws = details?.workspace_name ?? "this workspace";
  const role = (details?.role ?? "editor") as Role;

  return (
    <AuthStage
      ornament={
        <>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>You&apos;ve been invited</div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, width: "fit-content" }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontSize: 20 }}>{ws.trim()[0]?.toUpperCase() ?? "A"}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>Join</span>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, letterSpacing: "-0.015em", color: "var(--text-primary)" }}>{ws}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Your role: <span style={{ color: "var(--accent)" }}>{ROLE_LABEL[role]}</span>
            </div>
            {ROLE_PERMS[role].map((p, i) => (
              <PermBullet key={i} text={p} muted={i === ROLE_PERMS[role].length - 1 && role === "viewer"} />
            ))}
          </div>
        </>
      }
    >
      {loading ? (
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>Loading your invitation…</p>
      ) : loadError ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 28, letterSpacing: "-0.015em" }}>Invitation unavailable</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>{loadError}</p>
          <Link href="/login" className="btn btn-secondary" style={{ width: "fit-content" }}>Go to sign in</Link>
        </div>
      ) : signedIn ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 28, letterSpacing: "-0.015em" }}>Join {ws}</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>Signed in as <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{email}</strong>.</p>
          </div>
          {error && <p style={{ margin: 0, fontSize: 13, color: "#993C1D" }}>{error}</p>}
          <button onClick={accept} disabled={busy} className="btn btn-primary" style={{ width: "100%", height: 40, justifyContent: "center", gap: 6 }}>
            <span>{busy ? "Joining…" : `Accept & join ${ws}`}</span>
            {!busy && <IconArrowUpRight size={13} sw={1.8} />}
          </button>
        </div>
      ) : (
        <form onSubmit={authThenAccept} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 28, letterSpacing: "-0.015em" }}>Join {ws}</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>{mode === "signup" ? "Set a password to finish your account." : "Sign in to your existing account to join."}</p>
          </div>

          <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--bg-sidebar)", border: "1px solid var(--border)", borderRadius: 8 }}>
            {(["signup", "signin"] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(null); setNotice(null); }} style={{ flex: 1, height: 30, borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 500, fontFamily: "inherit", background: mode === m ? "var(--bg-card)" : "transparent", color: mode === m ? "var(--text-primary)" : "var(--text-muted)", boxShadow: mode === m ? "0 1px 2px rgba(20,20,18,0.08)" : "none" }}>
                {m === "signup" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <AuthField label="Email">
              <span style={authInputStyle()}>
                <span style={{ color: "var(--text-muted)", display: "flex" }}><IconMail size={14} /></span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={fieldInput} />
              </span>
            </AuthField>
            <AuthField label="Password">
              <span style={authInputStyle()}>
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={fieldInput} />
              </span>
            </AuthField>
            {error && <p style={{ margin: 0, fontSize: 13, color: "#993C1D" }}>{error}</p>}
            {notice && <p style={{ margin: 0, fontSize: 13, color: "var(--approved-text)" }}>{notice}</p>}
            <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: "100%", height: 40, justifyContent: "center", marginTop: 6, gap: 6 }}>
              <span>{busy ? "Joining…" : `Join ${ws}`}</span>
              {!busy && <IconArrowUpRight size={13} sw={1.8} />}
            </button>
          </div>
        </form>
      )}
    </AuthStage>
  );
}

function PermBullet({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: muted ? "var(--text-muted)" : "var(--text-primary)", opacity: muted ? 0.7 : 1 }}>
      <span style={{ width: 18, height: 18, borderRadius: 999, background: muted ? "var(--bg-card)" : "var(--accent-light)", color: muted ? "var(--text-muted)" : "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid ${muted ? "var(--border)" : "rgba(15,110,86,0.2)"}` }}>
        {muted ? <IconX size={10} sw={2} /> : <IconCheck size={11} sw={2.4} />}
      </span>
      <span>{text}</span>
    </div>
  );
}
