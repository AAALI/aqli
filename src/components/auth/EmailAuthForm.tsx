"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { emailAuthError, emailCallbackUrl, safeAuthNext } from "@/lib/auth/email";
import * as analytics from "@/lib/analytics";

type Props = {
  next: string;
  shouldCreateUser: boolean;
  title: string;
  eyebrow: string;
  description: string;
  initialEmail?: string;
  allowPassword?: boolean;
  footer?: ReactNode;
  beforeEmail?: ReactNode;
  notice?: string | null;
};

/** One email, one message containing a sign-in link. The link carries a token
 * hash, so it works from any browser, not only the one that asked for it. */
export default function EmailAuthForm({
  next, shouldCreateUser, title, eyebrow, description, initialEmail = "",
  allowPassword = false, footer, beforeEmail, notice: initialNotice,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"email" | "sent" | "password">("email");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);
  const destination = safeAuthNext(next);
  const address = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function complete(user: { id: string; email?: string }, method: string) {
    setLeaving(true);
    analytics.identify(user.id, { email: user.email ?? address });
    analytics.capture("user_logged_in", { method });
    // A full navigation re-derives onboarding and server auth from the cookie
    // session, including when /signup is already the mounted route.
    window.location.assign(destination);
  }

  async function send() {
    if (pending.current || leaving || !validEmail || cooldown > 0) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: {
          shouldCreateUser,
          emailRedirectTo: emailCallbackUrl(window.location.origin, destination),
        },
      });
      if (error) throw error;
      setEmail(address);
      setStage("sent");
      setCooldown(60);
    } catch (err) {
      setError(emailAuthError(err, "send", shouldCreateUser));
      if (err && typeof err === "object" && "status" in err && err.status === 429) setCooldown(60);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (stage !== "password") return send();
    if (pending.current || leaving) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: address, password });
      if (error) throw error;
      if (!data.session || !data.user) throw new Error("No session");
      complete(data.user, "password");
    } catch (err) {
      setError(emailAuthError(err, "password"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function changeStage(nextStage: typeof stage) {
    setStage(nextStage);
    setPassword("");
    setError(null);
    setNotice(null);
  }

  return (
    <form onSubmit={submit} aria-busy={busy || leaving}>
      <p className="ob-eb">{stage === "sent" ? "Check your email" : eyebrow}</p>
      <h1 className="ob-q">{stage === "sent" ? "Your inbox is the key." : title}</h1>
      <p className="ob-s">
        {stage === "sent" ? `We sent a sign-in link to ${address}. Open it on any device to continue.` : description}
      </p>
      {initialNotice && <p className="ob-note" role="status">{initialNotice}</p>}
      {stage !== "sent" && (
        <div className="ob-f">
          {stage === "email" && beforeEmail}
          <input
            className="inp lg" type="email" autoComplete="email" placeholder="you@company.com"
            aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            disabled={busy || leaving} required autoFocus
          />
          {stage === "password" && (
            <input className="inp lg" type="password" autoComplete="current-password"
              placeholder="Password" aria-label="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} disabled={busy || leaving} required />
          )}
        </div>
      )}
      {stage === "sent" && (
        <p className="ob-note">
          Use the newest email. Links expire and can only be used once. Check your spam folder if it hasn&apos;t arrived in a minute.
        </p>
      )}
      {error && <p className="ob-err" role="alert">{error}</p>}
      {notice && <p className="ob-note" role="status">{notice}</p>}
      <div className="ob-acts">
        {stage === "sent" ? (
          <>
            <button type="button" className="btn btn-primary btn-lg" disabled={busy || leaving || cooldown > 0} onClick={() => void send()}>
              {busy ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
            </button>
            <button type="button" className="ob-skip" disabled={busy || leaving} onClick={() => changeStage("email")}>Use a different email</button>
          </>
        ) : (
          <>
            <button type="submit" className="btn btn-primary btn-lg"
              disabled={busy || leaving || !validEmail || (stage === "email" && cooldown > 0) || (stage === "password" && !password)}>
              {leaving ? "Opening…" : busy ? stage === "email" ? "Sending…" : "Signing in…" : stage === "email" ? "Email me a sign-in link" : "Sign in"}
            </button>
            {allowPassword && (
              <button type="button" className="ob-skip" disabled={busy || leaving} onClick={() => changeStage(stage === "password" ? "email" : "password")}>
                {stage === "password" ? "Use an email link instead" : "Use password instead"}
              </button>
            )}
          </>
        )}
      </div>
      {cooldown > 0 && stage !== "sent" && <p className="ob-note" role="status">You can request another email in {cooldown}s.</p>}
      {footer && <div className="ob-acts">{footer}</div>}
    </form>
  );
}
