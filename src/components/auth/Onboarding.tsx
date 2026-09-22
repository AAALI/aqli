"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AqliMark } from "@/components/aqli/AqliMark";
import SpaceIcon from "@/components/aqli/SpaceIcon";
import { IconCheckCircle, IconLink } from "@/components/aqli/icons";
import {
  CUSTOM_SPACE_ICON,
  ONBOARDING_STEPS,
  SUGGESTED_SPACES,
  canAddCustomSpace,
  normalizeSlug,
  ONBOARDED_AT,
  resolveEntry,
  slugAlternatives,
  spacesToCreate,
  stepEyebrow,
  stepIndex,
  suggestSlug,
  toggleSpace,
  validateSlug,
  workspaceNameFromEmail,
  type StepKey,
} from "@/lib/onboarding/plan";
import * as analytics from "@/lib/analytics";

type Workspace = { id: string; slug: string; name: string };
type WorkspaceRow = Workspace & { settings?: Record<string, unknown> | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Create one space, surviving a blip.
 *
 * Onboarding fires these in parallel, one request per space, so a single
 * dropped connection or a cold start used to surface as a dead end on the last
 * step of setup — with the user's picks half-applied. Most of those failures
 * fix themselves on a second attempt, so the flow makes it rather than asking
 * the user to.
 *
 * Retried: network errors and 5xx. Not retried: a 4xx, which is a considered
 * refusal that will be refused identically next time. A 409 is success — the
 * space already exists, which is the end state this is aiming at.
 */
async function createSpace(
  workspaceId: string,
  space: { name: string; slug: string; icon: string },
  attempts = 3,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, ...space }),
      });
      if (res.ok || res.status === 409) return true;
      if (res.status < 500) return false;
    } catch {
      // Network-level failure — worth another go.
    }
    if (attempt < attempts - 1) await sleep(300 * 2 ** attempt);
  }
  return false;
}

export default function Onboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState<StepKey>("account");
  // Onboarding cannot render until we know where the user belongs; showing the
  // account form to someone already signed in is how the old flow ended up
  // asking existing members to create a second workspace.
  const [booting, setBooting] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // Pre-filled from the email domain until the person types (§5.2).
  const [nameInput, setNameInput] = useState<string | null>(null);
  const workspaceName = nameInput ?? workspaceNameFromEmail(email);
  const setWorkspaceName = setNameInput;
  const [editingUrl, setEditingUrl] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [takenSlugs, setTakenSlugs] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const [existingSpaces, setExistingSpaces] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>(["Company"]);
  const [customSpaces, setCustomSpaces] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");

  const [addingCustom, setAddingCustom] = useState(false);

  const [busy, setBusy] = useState(false);
  // The push into the workspace is a navigation, not a fetch — without this the
  // primary button snaps back to its idle label and looks like it did nothing.
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Spaces that failed to create. Kept so the user can move on rather than
  // being held on the step by an error that tells them to move on.
  const [spacesFailed, setSpacesFailed] = useState<string[]>([]);

  const effectiveSlug = slugTouched ? normalizeSlug(slug) : suggestSlug(workspaceName);
  const slugCheck = validateSlug(effectiveSlug);

  const loadSpaces = useCallback(async (workspaceId: string) => {
    const res = await fetch(`/api/spaces?workspace_id=${workspaceId}`);
    if (!res.ok) return [] as string[];
    const { spaces } = await res.json();
    const names = (spaces ?? []).map((s: { name: string }) => s.name) as string[];
    setExistingSpaces(names);
    setPicked((p) => Array.from(new Set([...names, ...p])));
    return names;
  }, []);

  /**
   * Progress is re-derived from the server on every mount rather than kept in
   * component state. A refresh, a closed tab, or the round trip through a
   * confirmation email used to drop the user back on the workspace step with no
   * memory that they had already created one — and retrying the same name hit
   * the unique constraint on `workspaces.slug`, which dead-ended the flow.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (user) setEmail(user.email ?? "");

        const workspaces: WorkspaceRow[] = user
          ? await fetch("/api/workspaces")
              .then((r) => (r.ok ? r.json() : { workspaces: [] }))
              .then((b) => b.workspaces ?? [])
              .catch(() => [])
          : [];

        // Only asked when a workspace exists, and only to answer "has this
        // been set up already?" — see `resolveEntry`.
        let spaceCount: number | undefined;
        let hasDocs: boolean | undefined;
        if (workspaces[0]) {
          const [names, docs] = await Promise.all([
            loadSpaces(workspaces[0].id).catch(() => [] as string[]),
            // Evidence for workspaces older than the `onboarded_at` stamp.
            fetch(`/api/docs?workspace_id=${workspaces[0].id}&limit=1`)
              .then((r) => (r.ok ? r.json() : { docs: [] }))
              .then((b) => (b.docs ?? []).length > 0)
              .catch(() => false),
          ]);
          spaceCount = names.length;
          hasDocs = docs;
        }

        if (cancelled) return;

        const onboardedAt = workspaces[0]?.settings?.[ONBOARDED_AT];
        const entry = resolveEntry({
          hasUser: !!user,
          workspaces,
          spaceCount,
          hasDocs,
          onboardedAt: typeof onboardedAt === "string" ? onboardedAt : null,
        });

        if (entry.kind === "redirect") {
          // Already onboarded — never ask for a second workspace.
          router.replace(entry.to);
          return;
        }

        if (entry.kind === "resume") {
          setWorkspace(entry.workspace);
          setWorkspaceName(entry.workspace.name);
          setSlug(entry.workspace.slug);
          setStep(entry.step);
        } else {
          // `/signup?step=workspace` is where the root page sends a confirmed
          // user who has no workspace yet.
          const requested = searchParams.get("step");
          setStep(requested === "workspace" && user ? "workspace" : entry.step);
        }
        setBooting(false);
      } catch {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Runs once: this is the entry decision, not a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Pick the session up as soon as it exists, whichever tab confirmed it.
   *
   * With email confirmation on, this tab is otherwise inert: the copy promises
   * the link "brings you straight back here", but opening it in a second tab
   * left this one sitting on "Check your inbox" with a "Log in" button as the
   * only way forward — a second password entry to reach a session this browser
   * already had.
   *
   * It polls rather than listening to `onAuthStateChange`. This app builds its
   * browser client with `@supabase/ssr`, which keeps the session in **cookies**
   * so the server can read it — not in localStorage. That means no `storage`
   * event and no cross-tab broadcast to subscribe to. Cookies are shared across
   * tabs of the same origin, so asking is what works. (Confirming in a
   * different browser or on a phone still needs a log in; nothing in this tab
   * can know about that.)
   */
  useEffect(() => {
    if (!awaitingConfirmation) return;
    let stop = false;
    const timer = setInterval(async () => {
      const { data } = await supabase.auth.getUser();
      if (stop || !data.user) return;
      clearInterval(timer);
      setAwaitingConfirmation(false);
      setEmail(data.user.email ?? "");
      setNotice(null);
      setError(null);
      setStep("workspace");
    }, 2500);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [awaitingConfirmation, supabase]);

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      // Email and password, and nothing else is asked (§5.1). Until a name is
      // set, the app greets people by the first part of their email.
      const name = email.split("@")[0] ?? "";
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // The confirmation email lands on /auth/callback, which exchanges the
          // code for a session and resumes onboarding at the workspace step.
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/signup?step=workspace")}`,
        },
      });
      if (error) throw error;
      if (!data.session) {
        // Email confirmation is on. Nothing more can happen in this tab until
        // the link is opened, so say so plainly and offer a resend rather than
        // leaving a live "Continue" button that only ever errors.
        setAwaitingConfirmation(true);
        return;
      }
      analytics.identify(data.user!.id, { email, name });
      analytics.capture("user_signed_up", { email, name });
      setStep("workspace");
    } catch (err) {
      analytics.captureException(err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/signup?step=workspace")}`,
        },
      });
      if (error) throw error;
      setNotice("Sent. Check your inbox again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend");
    } finally {
      setBusy(false);
    }
  }

  async function submitWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSlugError(null);
    if (!slugCheck.ok) {
      setSlugError(slugCheck.reason);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName.trim(), slug: effectiveSlug }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.status === 409) {
        // Remember the collision so the offered alternatives converge instead
        // of proposing the same taken slug over and over.
        setTakenSlugs((t) => Array.from(new Set([...t, effectiveSlug])));
        setSlugError(body.error ?? "That URL is taken.");
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Could not create workspace");

      const created: Workspace = body.workspace;
      setWorkspace(created);
      analytics.capture("workspace_created", {
        workspace_id: created.id,
        workspace_slug: created.slug,
        workspace_name: created.name,
      });
      await loadSpaces(created.id).catch(() => []);
      setStep("spaces");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function submitSpaces() {
    if (!workspace) return;
    setBusy(true);
    setError(null);
    try {
      const toCreate = spacesToCreate(picked, existingSpaces, customSpaces);
      const results = await Promise.all(
        toCreate.map(async (s) => ({
          name: s.name,
          ok: await createSpace(workspace.id, s),
        })),
      );

      const failed = results.filter((r) => !r.ok).map((r) => r.name);
      await loadSpaces(workspace.id).catch(() => []);

      if (failed.length) {
        // Reported, not swallowed — a silent catch-all used to advance anyway,
        // so a user could finish onboarding believing in spaces that were
        // never created. By this point `createSpace` has already retried, so
        // this is a real failure rather than a blip, and both a further retry
        // and a way past it are offered.
        setSpacesFailed(failed);
        setError(
          `Couldn't create ${failed.join(", ")}. Try again, or carry on and add ${failed.length > 1 ? "them" : "it"} from the sidebar later.`,
        );
        return;
      }
      setSpacesFailed([]);
      finish("spaces");
    } catch {
      setSpacesFailed(picked.filter((p) => !existingSpaces.includes(p)));
      setError("Couldn't reach the server. Try again, or carry on and add your spaces later.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Leave onboarding. Called by both actions on the last step — Start writing
   * and "Company is fine — skip". There is no confirmation screen in between:
   * the next thing on screen is a cursor.
   */
  const finish = useCallback(
    (via: string) => {
      if (!workspace) return;
      setLeaving(true);
      analytics.capture("onboarding_completed", { workspace_id: workspace.id, via });
      // Record that setup is done, so coming back to /signup sends this user
      // into their workspace instead of walking them through it again. Not
      // awaited — `keepalive` carries it past the navigation, and a workspace
      // that ends up unstamped still reads as onboarded once it holds a second
      // space or a single doc.
      void fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { [ONBOARDED_AT]: new Date().toISOString() } }),
        keepalive: true,
      }).catch(() => {});
      // Three screens, then a cursor (§13): the editor, not a welcome page.
      router.push(`/w/${workspace.slug}/write`);
      router.refresh();
    },
    [workspace, router],
  );

  function addCustomSpace() {
    const name = customDraft.trim();
    const known = [...SUGGESTED_SPACES.map((s) => s.name), ...customSpaces, ...existingSpaces];
    if (!canAddCustomSpace(name, known)) return;
    setCustomSpaces((c) => [...c, name]);
    setPicked((p) => [...p, name]);
    setCustomDraft("");
    setAddingCustom(false);
  }

  const allSpaceOptions = [
    ...SUGGESTED_SPACES,
    ...customSpaces.map((name) => ({ icon: CUSTOM_SPACE_ICON, name, desc: "Your own space" })),
  ];
  const newSpaceCount = spacesToCreate(picked, existingSpaces, customSpaces).length;
  const googleSso = process.env.NEXT_PUBLIC_GOOGLE_SSO === "1";

  async function continueWithGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/signup?step=workspace")}`,
      },
    });
    if (error) setError(error.message);
  }

  if (booting) return <BootingScreen />;

  return (
    <div className="ob">
      <div className="ob-t">
        <Link href="/" className="wm" aria-label="Aqli">
          <AqliMark size={20} />
          <span>aqli</span>
        </Link>
        <div className="ob-steps" aria-label={`Step ${stepIndex(step) + 1} of ${ONBOARDING_STEPS.length}`}>
          {ONBOARDING_STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`ob-dot${i === stepIndex(step) ? " on" : i < stepIndex(step) ? " done" : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="ob-mid">
        {step === "account" &&
          (awaitingConfirmation ? (
            <div className="ob-card">
              <p className="ob-eb">Check your inbox</p>
              <h1 className="ob-q">Confirm your email.</h1>
              <p className="ob-s">
                We sent a link to {email}. Opening it brings you straight back here — you can close this tab safely.
              </p>
              {error && <p className="ob-err" role="alert">{error}</p>}
              {notice && <p className="ob-note">{notice}</p>}
              <div className="ob-acts">
                <button type="button" className="btn btn-secondary btn-lg" onClick={resendConfirmation} disabled={busy}>
                  {busy ? "Sending…" : "Send it again"}
                </button>
                <Link href="/login" className="ob-skip">Already confirmed? Sign in</Link>
              </div>
            </div>
          ) : (
            <form className="ob-card" onSubmit={submitAccount}>
              <p className="ob-eb">{stepEyebrow("account")}</p>
              <h1 className="ob-q">Let&apos;s get you writing.</h1>
              <p className="ob-s">Two minutes from here to a published doc. You can change everything later.</p>
              <div className="ob-f">
                {googleSso && (
                  <>
                    <button type="button" className="btn btn-secondary btn-lg" style={{ justifyContent: "center" }} onClick={continueWithGoogle}>
                      <GoogleMark /> Continue with Google
                    </button>
                    <div className="ob-or"><hr /><span>or</span><hr /></div>
                  </>
                )}
                <input
                  className="inp lg"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  aria-label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                <input
                  className="inp lg"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Password — at least 8 characters"
                  aria-label="Password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="ob-err" role="alert">{error}</p>}
              <div className="ob-acts">
                <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !email || password.length < 8}>
                  {busy ? "Creating…" : "Continue"}
                  {!busy && <span className="kbd kbd-on-accent">⏎</span>}
                </button>
                <span className="ob-skip">
                  Already have an account?{" "}
                  <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none" }}>Sign in</Link>
                </span>
              </div>
            </form>
          ))}

        {step === "workspace" && (
          <form className="ob-card" onSubmit={submitWorkspace}>
            <p className="ob-eb">{stepEyebrow("workspace")}</p>
            <h1 className="ob-q">What should we call it?</h1>
            <p className="ob-s">The name your team will see at the top of every page.</p>
            <div className="ob-f">
              <input
                className="inp lg"
                aria-label="Workspace name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
                autoFocus
              />
              {/* Derived, not asked for (§5.2). Changeable, for the rare
                  person who cares, one click away. */}
              {editingUrl ? (
                <div className="ob-url">
                  <span>aqli.app/</span>
                  <input
                    className="inp"
                    aria-label="Workspace URL"
                    value={slugTouched ? slug : effectiveSlug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugTouched(true);
                      setSlugError(null);
                    }}
                  />
                </div>
              ) : (
                <p className="hint" style={{ margin: 0 }}>
                  <IconLink size={13} /> aqli.app/
                  <b style={{ color: "var(--text-secondary)", fontWeight: 600, marginLeft: -4 }}>{effectiveSlug || "…"}</b> ·{" "}
                  <button type="button" className="ob-link" onClick={() => setEditingUrl(true)}>change</button>
                </p>
              )}
              {(slugError || (slugTouched && !slugCheck.ok)) && (
                <p className="ob-err" role="alert">{slugError ?? (!slugCheck.ok ? slugCheck.reason : "")}</p>
              )}
              {slugError && (
                <div className="pickrow">
                  {slugAlternatives(workspaceName || effectiveSlug, takenSlugs).map((alt) => (
                    <button
                      key={alt}
                      type="button"
                      className="pick"
                      onClick={() => {
                        setSlug(alt);
                        setSlugTouched(true);
                        setSlugError(null);
                        setEditingUrl(true);
                      }}
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {error && <p className="ob-err" role="alert">{error}</p>}
            <div className="ob-acts">
              <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !workspaceName.trim() || !slugCheck.ok}>
                {busy ? "Creating…" : "Continue"}
                {!busy && <span className="kbd kbd-on-accent">⏎</span>}
              </button>
            </div>
          </form>
        )}

        {step === "spaces" && (
          <form
            className="ob-card"
            style={{ width: 520 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (newSpaceCount === 0 || spacesFailed.length) finish(spacesFailed.length ? "spaces-partial" : "spaces");
              else void submitSpaces();
            }}
          >
            <p className="ob-eb">{stepEyebrow("spaces")}</p>
            <h1 className="ob-q">Anywhere else to put things?</h1>
            <p className="ob-s">
              Spaces are just shelves. <b style={{ fontWeight: 600 }}>Company</b> is ready — add more now or whenever you need them.
            </p>
            <div className="ob-f">
              <div className="pickrow">
                {allSpaceOptions.map((opt) => {
                  const on = picked.some((p) => p.toLowerCase() === opt.name.toLowerCase());
                  const locked = existingSpaces.some((e) => e.toLowerCase() === opt.name.toLowerCase());
                  return (
                    <button
                      key={opt.name}
                      type="button"
                      aria-pressed={on}
                      title={locked ? "Already created" : opt.desc}
                      className={`pick${on ? " is-on" : ""}`}
                      onClick={() => setPicked((p) => toggleSpace(p, opt.name, existingSpaces))}
                    >
                      <span className="em"><SpaceIcon icon={opt.icon} /></span>
                      {opt.name}
                    </button>
                  );
                })}
                {addingCustom ? (
                  <input
                    className="inp"
                    style={{ width: 180, height: 32, borderRadius: 999 }}
                    autoFocus
                    aria-label="Name a space"
                    placeholder="Name it"
                    value={customDraft}
                    onChange={(e) => setCustomDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomSpace();
                      } else if (e.key === "Escape") {
                        setAddingCustom(false);
                      }
                    }}
                    onBlur={() => (customDraft.trim() ? addCustomSpace() : setAddingCustom(false))}
                  />
                ) : (
                  <button type="button" className="pick" style={{ color: "var(--text-muted)", borderStyle: "dashed" }} onClick={() => setAddingCustom(true)}>
                    ＋ Something else
                  </button>
                )}
              </div>
            </div>
            {error && <p className="ob-err" role="alert">{error}</p>}
            <div className="ob-acts">
              <button type="submit" className="btn btn-primary btn-lg" disabled={busy || leaving}>
                {busy ? "Making spaces…" : leaving ? "Opening…" : "Start writing"}
                {!busy && !leaving && <span className="kbd kbd-on-accent">⏎</span>}
              </button>
              <button type="button" className="ob-skip" disabled={busy || leaving} onClick={() => finish("skip")}>
                Company is fine — skip
              </button>
            </div>
            <p className="hint" style={{ marginTop: 26, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <IconCheckCircle size={13} /> Connecting AI agents and teammates now lives in Settings — nothing here blocks you.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function BootingScreen() {
  return <div className="ob" aria-busy="true" />;
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h6.1a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.5-5 3.5-8.5Z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.8-2.9l-3.7-2.9c-1.1.7-2.4 1.1-4.1 1.1a7.2 7.2 0 0 1-6.8-5H1.4v3a12 12 0 0 0 10.6 6.7Z" />
      <path fill="#FBBC05" d="M5.2 14.3a7.2 7.2 0 0 1 0-4.6v-3H1.4a12 12 0 0 0 0 10.6l3.8-3Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.3-3.3A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.4 6.7l3.8 3A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  );
}
