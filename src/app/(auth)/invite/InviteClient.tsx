"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthStage } from "@/components/auth/AuthShell";
import type { InvitationDetails, Role } from "@/types/invitation";
import * as analytics from "@/lib/analytics";

const ROLE_WORDS: Record<Role, string> = {
  admin: "as an admin",
  editor: "to write, publish and check docs",
  viewer: "to read",
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
      analytics.capture("invitation_accepted", { workspace_slug: slug });
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // The confirmation email returns the user to this invite so they
            // can accept it with a live session.
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/invite?token=${token}`)}`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Account created — check your email. The confirmation link brings you back to this invite to join.");
          setBusy(false);
          return;
        }
        analytics.identify(data.user!.id, { email });
        analytics.capture("user_signed_up", { email, via: "invite" });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) analytics.identify(data.user.id, { email });
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
    <AuthStage>
      {loading ? (
        <p className="ob-s" style={{ margin: 0 }}>Opening your invitation…</p>
      ) : loadError ? (
        <>
          <h1 className="ob-q" style={{ marginTop: 0 }}>This invitation doesn&apos;t work any more.</h1>
          <p className="ob-s">{loadError}</p>
          <div className="ob-acts">
            <Link href="/login" className="btn btn-secondary btn-lg">Go to sign in</Link>
          </div>
        </>
      ) : signedIn ? (
        <>
          <p className="ob-eb">You&apos;re invited</p>
          <h1 className="ob-q">Join {ws}.</h1>
          <p className="ob-s">
            You&apos;ve been invited {ROLE_WORDS[role]}. Signed in as <b style={{ fontWeight: 600 }}>{email}</b>.
          </p>
          {error && <p className="ob-err" role="alert">{error}</p>}
          <div className="ob-acts">
            <button type="button" onClick={accept} disabled={busy} className="btn btn-primary btn-lg">
              {busy ? "Joining…" : `Join ${ws}`}
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={authThenAccept}>
          <p className="ob-eb">You&apos;re invited</p>
          <h1 className="ob-q">Join {ws}.</h1>
          <p className="ob-s">
            You&apos;ve been invited {ROLE_WORDS[role]}.{" "}
            {mode === "signup" ? "Set a password and you're in." : "Sign in with your existing account."}
          </p>
          <div className="ob-f">
            <input className="inp lg" type="email" aria-label="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="inp lg" type="password" aria-label="Password" placeholder="Password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <p className="ob-err" role="alert">{error}</p>}
          {notice && <p className="ob-note">{notice}</p>}
          <div className="ob-acts">
            <button type="submit" disabled={busy} className="btn btn-primary btn-lg">
              {busy ? "Joining…" : `Join ${ws}`}
              {!busy && <span className="kbd kbd-on-accent">⏎</span>}
            </button>
            <button
              type="button"
              className="ob-skip"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError(null);
                setNotice(null);
              }}
            >
              {mode === "signup" ? "Already have an account? Sign in" : "New to Aqli? Create an account"}
            </button>
          </div>
        </form>
      )}
    </AuthStage>
  );
}
