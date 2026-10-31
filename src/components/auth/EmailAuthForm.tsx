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

/** One email, one message containing a link and a code. No verifier is needed
 * for email+code verification, including in a different browser. */
export default function EmailAuthForm({
  next, shouldCreateUser, title, eyebrow, description, initialEmail = "",
  allowPassword = false, footer, beforeEmail, notice: initialNotice,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code" | "password">("email");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const destination = safeAuthNext(next);
  const address = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

  useEffect(() => {
    if (stage === "code") codeInput.current?.focus();
  }, [stage]);

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
      setCode("");
      setStage("code");
      setCooldown(60);
      setNotice("Email sent. Use the link or enter its six-digit code below.");
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
    if (stage === "email") return send();
    if (pending.current || leaving) return;
    if (stage === "code" && !/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code from your email.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error } = stage === "password"
        ? await supabase.auth.signInWithPassword({ email: address, password })
        : await supabase.auth.verifyOtp({ email: address, token: code, type: "email" });
      if (error) throw error;
      if (!data.session || !data.user) throw new Error("No session");
      complete(data.user, stage === "password" ? "password" : "email_otp");
    } catch (err) {
      setError(emailAuthError(err, stage === "password" ? "password" : "verify"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function changeStage(nextStage: typeof stage) {
    setStage(nextStage);
    setCode("");
    setPassword("");
    setError(null);
    setNotice(null);
  }

  return (
    <form onSubmit={submit} aria-busy={busy || leaving}>
      <p className="ob-eb">{stage === "code" ? "Check your email" : eyebrow}</p>
      <h1 className="ob-q">{stage === "code" ? "Your inbox is the key." : title}</h1>
      <p className="ob-s">
        {stage === "code" ? `Open the link sent to ${address}, or enter its six-digit code. You can enter a code from another browser too.` : description}
      </p>
      {initialNotice && <p className="ob-note" role="status">{initialNotice}</p>}
      <div className="ob-f">
        {stage === "email" && beforeEmail}
        {stage !== "code" ? (
          <input
            className="inp lg" type="email" autoComplete="email" placeholder="you@company.com"
            aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            disabled={busy || leaving} required autoFocus
          />
        ) : (
          <input
            ref={codeInput}
            className="inp lg" type="text" inputMode="numeric" autoComplete="one-time-code"
            aria-label="Six-digit email code" placeholder="123456" pattern="[0-9]{6}"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={busy || leaving} required autoFocus
            aria-describedby="email-code-help"
          />
        )}
        {stage === "password" && (
          <input className="inp lg" type="password" autoComplete="current-password"
            placeholder="Password" aria-label="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={busy || leaving} required />
        )}
      </div>
      {stage === "code" && (
        <p id="email-code-help" className="ob-note">
          Use the newest email. Codes and links expire and can only be used once.
        </p>
      )}
      {error && <p className="ob-err" role="alert">{error}</p>}
      {notice && <p className="ob-note" role="status">{notice}</p>}
      <div className="ob-acts">
        <button type="submit" className="btn btn-primary btn-lg"
          disabled={busy || leaving || !validEmail || (stage === "email" && cooldown > 0) || (stage === "code" && code.length !== 6) || (stage === "password" && !password)}>
          {leaving ? "Opening…" : busy ? stage === "email" ? "Sending…" : "Signing in…" : stage === "email" ? "Email me a link and code" : stage === "password" ? "Sign in" : "Verify code"}
        </button>
        {stage === "code" ? (
          <>
            <button type="button" className="ob-skip" disabled={busy || leaving || cooldown > 0} onClick={() => void send()}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
            </button>
            <button type="button" className="ob-skip" disabled={busy || leaving} onClick={() => changeStage("email")}>Use a different email</button>
          </>
        ) : (
          <>
            <button type="button" className="ob-skip" disabled={busy || leaving || !validEmail} onClick={() => changeStage("code")}>I already have a code</button>
            {allowPassword && (
              <button type="button" className="ob-skip" disabled={busy || leaving} onClick={() => changeStage(stage === "password" ? "email" : "password")}>
                {stage === "password" ? "Use an email link instead" : "Use password instead"}
              </button>
            )}
          </>
        )}
      </div>
      {cooldown > 0 && stage !== "code" && <p className="ob-note" role="status">You can request another email in {cooldown}s.</p>}
      {footer && <div className="ob-acts">{footer}</div>}
    </form>
  );
}
