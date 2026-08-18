"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AqliMark } from "@/components/aqli/AqliMark";
import {
  IconCheck,
  IconCheckCircle,
  IconKey,
  IconRobot,
  IconSparkle,
  IconWarn,
} from "@/components/aqli/icons";
import {
  CUSTOM_SPACE_EMOJI,
  NUMBERED_STEPS,
  ONBOARDING_STEPS,
  SUGGESTED_SPACES,
  canAddCustomSpace,
  normalizeSlug,
  resolveEntry,
  resumeNeedsEscape,
  slugAlternatives,
  spacesToCreate,
  stepEyebrow,
  stepIndex,
  suggestSlug,
  toggleSpace,
  validateSlug,
  type StepKey,
} from "@/lib/onboarding/plan";
import * as analytics from "@/lib/analytics";

type Workspace = { id: string; slug: string; name: string };

export default function Onboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState<StepKey>("account");
  // Onboarding cannot render until we know where the user belongs; showing the
  // account form to someone already signed in is how the old flow ended up
  // asking existing members to create a second workspace.
  const [booting, setBooting] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const [workspaceName, setWorkspaceName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [takenSlugs, setTakenSlugs] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const [existingSpaces, setExistingSpaces] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>(["Company"]);
  const [customSpaces, setCustomSpaces] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");

  const [agentName, setAgentName] = useState("Claude");
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
  // Set when this run resumed an existing workspace — see `resumeNeedsEscape`.
  const [resumed, setResumed] = useState(false);

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

        const workspaces: Workspace[] = user
          ? await fetch("/api/workspaces")
              .then((r) => (r.ok ? r.json() : { workspaces: [] }))
              .then((b) => b.workspaces ?? [])
              .catch(() => [])
          : [];

        // The space count decides whether a workspace is still mid-setup, so it
        // is only needed when one exists.
        let spaceCount: number | undefined;
        if (workspaces[0]) {
          const names = await loadSpaces(workspaces[0].id).catch(() => [] as string[]);
          spaceCount = names.length;
        }

        if (cancelled) return;

        const entry = resolveEntry({ hasUser: !!user, workspaces, spaceCount });

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
          // A workspace holding only its seeded space might be an abandoned
          // setup or a finished one. Rather than guess, offer the way out.
          setResumed(resumeNeedsEscape(entry));
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
      const name = fullName.trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
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
        toCreate.map(async (s) => {
          const res = await fetch("/api/spaces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspace_id: workspace.id,
              name: s.name,
              slug: s.slug,
              icon: s.icon,
            }),
          });
          // A 409 means the space is already there — the desired end state.
          return { name: s.name, ok: res.ok || res.status === 409 };
        }),
      );

      const failed = results.filter((r) => !r.ok).map((r) => r.name);
      await loadSpaces(workspace.id).catch(() => []);

      if (failed.length) {
        // These failures must be reported — a silent catch-all used to advance
        // anyway, so a user could finish onboarding believing in spaces that
        // were never created. But reporting them is not a reason to hold the
        // user here: the message says "you can add them later", and refusing
        // to move on contradicts it. The retry stays available, and so does
        // the way forward.
        setSpacesFailed(failed);
        setError(
          `Couldn't create ${failed.join(", ")}. Try again, or carry on and add ${failed.length > 1 ? "them" : "it"} from the sidebar later.`,
        );
        return;
      }
      setSpacesFailed([]);
      setStep("assistant");
    } catch {
      setSpacesFailed(picked.filter((p) => !existingSpaces.includes(p)));
      setError("Couldn't reach the server. Try again, or carry on and add your spaces later.");
    } finally {
      setBusy(false);
    }
  }

  async function createKey() {
    if (!workspace) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspace.id, name: agentName.trim() || "Claude" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not create a key");
      // `createApiKey` returns the plain key once, as `secret`; only the hash
      // is stored, so there is no second chance to read it.
      const secret: string | undefined = body.key?.secret;
      if (!secret) throw new Error("The key was created but could not be read. Find it in Settings → API keys.");
      setIssuedKey(secret);
      analytics.capture("onboarding_key_created", { workspace_id: workspace.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a key");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!issuedKey) return;
    try {
      await navigator.clipboard.writeText(issuedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the key and copy it manually.");
    }
  }

  /**
   * Leave onboarding. Called by every terminal action — skipping the AI step,
   * continuing after a key is issued, and the escape offered on a resumed run.
   * There is no confirmation screen in between: the workspace's own empty
   * state is the welcome, and it comes with the button that writes doc one.
   */
  const finish = useCallback(
    (via: string) => {
      if (!workspace) return;
      setLeaving(true);
      analytics.capture("onboarding_completed", { workspace_id: workspace.id, via });
      router.push(`/w/${workspace.slug}`);
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
  }

  const allSpaceOptions = [
    ...SUGGESTED_SPACES,
    ...customSpaces.map((name) => ({ emoji: CUSTOM_SPACE_EMOJI, name, desc: "Your own space" })),
  ];
  const knownSpaceNames = [
    ...SUGGESTED_SPACES.map((s) => s.name),
    ...customSpaces,
    ...existingSpaces,
  ];
  const newSpaceCount = spacesToCreate(picked, existingSpaces, customSpaces).length;

  if (booting) return <BootingScreen />;

  return (
    <div className="onb">
      <StepRail current={step} />
      <div className="onb-stage">
        <div className="onb-topbar">
          {step === "account" ? (
            <span>
              Already have an account?{" "}
              <Link href="/login" style={{ color: "var(--accent)", fontWeight: 500, textDecoration: "none" }}>
                Log in
              </Link>
            </span>
          ) : workspace ? (
            <span>
              Workspace{" "}
              <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{workspace.name}</strong>
            </span>
          ) : email ? (
            <span>
              Signed in as{" "}
              <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{email}</strong>
            </span>
          ) : null}
        </div>

        <div className="onb-body">
          {/* The spaces step carries eight options; it gets a wider column so
              they lay out two-up and the primary action stays above the fold. */}
          <div className={`onb-col${step === "spaces" ? " is-wide" : ""}`}>
            {step === "account" &&
              (awaitingConfirmation ? (
                <Stage
                  eyebrow="Check your inbox"
                  title="Confirm your email."
                  sub={`We sent a link to ${email}. Opening it brings you straight back here to name your workspace.`}
                >
                  <Panel>
                    <PanelRow icon={<IconCheckCircle size={15} />} tone="ok">
                      Your account exists. Nothing else happens in this tab until the link is
                      opened — you can close it safely.
                    </PanelRow>
                  </Panel>
                  {error && <Msg tone="error">{error}</Msg>}
                  {notice && <Msg tone="ok">{notice}</Msg>}
                  <Footer
                    left={
                      <button type="button" className="btn btn-ghost onb-btn" onClick={resendConfirmation} disabled={busy}>
                        {busy ? "Sending…" : "Resend email"}
                      </button>
                    }
                    right={
                      <Link href="/login" className="btn btn-primary onb-btn onb-btn-primary">
                        Already confirmed? Log in
                      </Link>
                    }
                  />
                </Stage>
              ) : (
                <Stage
                  eyebrow={stepEyebrow("account")}
                  title="Set up your account."
                  sub="Aqli is your company's knowledge base — one your team writes and your AI tools can read. You'll be writing in under five minutes."
                >
                  <form onSubmit={submitAccount} className="onb-form">
                    <Field label="Full name" hint="So your team and agents can see who wrote what.">
                      <TextInput value={fullName} onChange={setFullName} placeholder="Ada Lovelace" required autoFocus />
                    </Field>
                    <Field label="Work email">
                      <TextInput type="email" value={email} onChange={setEmail} placeholder="you@team.com" required />
                    </Field>
                    <Field label="Password" hint="At least 6 characters. We never see it.">
                      <TextInput type="password" value={password} onChange={setPassword} placeholder="••••••••••••" minLength={6} required />
                    </Field>
                    {error && <Msg tone="error">{error}</Msg>}
                    <Footer
                      left={
                        <span style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 320 }}>
                          By continuing you agree to the{" "}
                          <Link href="/terms" style={{ color: "var(--text-secondary)" }}>Terms</Link> and{" "}
                          <Link href="/privacy" style={{ color: "var(--text-secondary)" }}>Privacy policy</Link>.
                        </span>
                      }
                      right={
                        <button type="submit" className="btn btn-primary onb-btn onb-btn-primary" disabled={busy || !fullName.trim()}>
                          {busy ? "Creating…" : "Continue"}
                        </button>
                      }
                    />
                  </form>
                </Stage>
              ))}

            {step === "workspace" && (
              <Stage
                eyebrow={stepEyebrow("workspace")}
                title="Name your workspace."
                sub="One workspace per team or organisation. You can rename it later."
              >
                <form onSubmit={submitWorkspace} className="onb-form">
                  <Field label="Workspace name">
                    <TextInput value={workspaceName} onChange={setWorkspaceName} placeholder="e.g. ACME" required autoFocus />
                  </Field>
                  <Field
                    label="Workspace URL"
                    hint={slugError ? undefined : "Used for share links and AI integrations."}
                    error={slugError ?? (slugTouched && !slugCheck.ok ? slugCheck.reason : undefined)}
                  >
                    <TextInput
                      mono
                      prefix="aqli.app/w/"
                      value={slugTouched ? slug : effectiveSlug}
                      onChange={(v) => {
                        setSlug(v);
                        setSlugTouched(true);
                        setSlugError(null);
                      }}
                      placeholder="acme"
                      invalid={!!slugError}
                    />
                  </Field>

                  {slugError && (
                    <div className="onb-alts">
                      <span className="onb-alts-label">Available instead</span>
                      <div className="onb-alts-row">
                        {slugAlternatives(workspaceName || effectiveSlug, takenSlugs).map((alt) => (
                          <button
                            key={alt}
                            type="button"
                            className="onb-chip"
                            onClick={() => {
                              setSlug(alt);
                              setSlugTouched(true);
                              setSlugError(null);
                            }}
                          >
                            {alt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Panel>
                    <PanelRow icon={<IconSparkle size={15} />}>
                      We&apos;ll start you off with a{" "}
                      <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Company</strong>{" "}
                      space for handbooks and policies. You&apos;ll pick spaces for your teams next.
                    </PanelRow>
                  </Panel>

                  {error && <Msg tone="error">{error}</Msg>}
                  <Footer
                    right={
                      <button type="submit" className="btn btn-primary onb-btn onb-btn-primary" disabled={busy || !workspaceName.trim() || !slugCheck.ok}>
                        {busy ? "Creating…" : "Continue"}
                      </button>
                    }
                  />
                </form>
              </Stage>
            )}

            {step === "spaces" && (
              <Stage
                eyebrow={stepEyebrow("spaces")}
                title="What lives where?"
                sub="One space per team usually works. Pick the teams you have — you can add or remove any of them later."
              >
                <div className="onb-spaces">
                  {allSpaceOptions.map((s) => {
                    const on = picked.some((p) => p.toLowerCase() === s.name.toLowerCase());
                    const locked = existingSpaces.some((e) => e.toLowerCase() === s.name.toLowerCase());
                    return (
                      <button
                        key={s.name}
                        type="button"
                        aria-pressed={on}
                        disabled={locked}
                        onClick={() => setPicked((p) => toggleSpace(p, s.name, existingSpaces))}
                        className={`onb-space${on ? " is-on" : ""}${locked ? " is-locked" : ""}`}
                      >
                        <span className="onb-space-tick">{on && <IconCheck size={12} />}</span>
                        <span className="onb-space-emoji">{s.emoji}</span>
                        <span className="onb-space-copy">
                          <span className="onb-space-name">
                            {s.name}
                            {locked && <span className="onb-space-tag">added</span>}
                          </span>
                          <span className="onb-space-desc">{s.desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="onb-custom">
                  <TextInput
                    value={customDraft}
                    onChange={setCustomDraft}
                    placeholder="Add your own — e.g. Legal, Design, Support"
                    onEnter={addCustomSpace}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost onb-btn"
                    onClick={addCustomSpace}
                    disabled={!canAddCustomSpace(customDraft, knownSpaceNames)}
                  >
                    Add
                  </button>
                </div>

                {error && <Msg tone="error">{error}</Msg>}
                <Footer
                  left={
                    resumed ? (
                      <button
                        type="button"
                        className="btn btn-ghost onb-btn"
                        onClick={() => finish("resume-escape")}
                        disabled={leaving}
                      >
                        Skip to workspace
                      </button>
                    ) : (
                      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                        {newSpaceCount === 0 ? "Company space only" : `${newSpaceCount} to create`}
                      </span>
                    )
                  }
                  right={
                    <div className="onb-actions">
                      {/* A failure here never holds the user: the message says
                          they can add these later, so the flow has to let them. */}
                      {spacesFailed.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost onb-btn"
                          onClick={() => setStep("assistant")}
                          disabled={busy}
                        >
                          Carry on
                        </button>
                      )}
                      <button type="button" className="btn btn-primary onb-btn onb-btn-primary" onClick={submitSpaces} disabled={busy}>
                        {busy ? "Creating…" : spacesFailed.length > 0 ? "Try again" : "Continue"}
                      </button>
                    </div>
                  }
                />
              </Stage>
            )}

            {step === "assistant" && (
              <Stage
                eyebrow={stepEyebrow("assistant")}
                title="Connect your AI."
                sub="Aqli works with any assistant your team uses — Claude, ChatGPT, Cursor. They read your approved docs for context and draft updates for you to review. Optional, and changeable later."
              >
                {issuedKey ? (
                  <>
                    <Panel tone="ok">
                      <PanelRow icon={<IconCheckCircle size={15} />} tone="ok">
                        Key created for <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{agentName}</strong>. Copy it now —
                        it is not shown again.
                      </PanelRow>
                      <div className="onb-key">
                        <code>{issuedKey}</code>
                        <button type="button" className="btn btn-ghost onb-btn" onClick={copyKey}>
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </Panel>
                    <Panel>
                      <PanelRow icon={<IconRobot size={15} />}>
                        Paste it into your assistant&apos;s tool settings. It can read approved docs
                        and submit drafts — nothing goes live without your review.
                      </PanelRow>
                    </Panel>
                  </>
                ) : (
                  <>
                    <Field label="Assistant name" hint="So you can recognise it in the AI activity log.">
                      <TextInput value={agentName} onChange={setAgentName} placeholder="e.g. Claude, ChatGPT, Cursor" onEnter={createKey} />
                    </Field>
                    <Panel>
                      <PanelRow icon={<IconKey size={15} />}>
                        We&apos;ll generate an access key scoped to read approved docs and propose
                        changes. You can revoke it any time from <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Settings → API keys</strong>.
                      </PanelRow>
                    </Panel>
                  </>
                )}

                {error && <Msg tone="error">{error}</Msg>}
                <Footer
                  left={
                    <button type="button" className="btn btn-ghost onb-btn" onClick={() => setStep("spaces")}>
                      Back
                    </button>
                  }
                  right={
                    <div className="onb-actions">
                      {!issuedKey && (
                        <>
                          {/* Straight into the workspace — there is no summary
                              screen between here and writing something. */}
                          <button
                            type="button"
                            className="btn btn-ghost onb-btn"
                            onClick={() => finish("skipped-key")}
                            disabled={leaving}
                          >
                            {leaving ? "Opening…" : "Skip for now"}
                          </button>
                          <button type="button" className="btn btn-primary onb-btn onb-btn-primary" onClick={createKey} disabled={busy || leaving}>
                            {busy ? "Creating…" : "Create key"}
                          </button>
                        </>
                      )}
                      {issuedKey && (
                        <button
                          type="button"
                          className="btn btn-primary onb-btn onb-btn-primary"
                          onClick={() => finish("created-key")}
                          disabled={leaving}
                        >
                          {leaving ? "Opening…" : "Open workspace"}
                        </button>
                      )}
                    </div>
                  }
                />
              </Stage>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Chrome ───────── */

function BootingScreen() {
  return (
    <div className="onb-boot">
      <AqliMark size={26} />
      <span>Getting your workspace ready…</span>
    </div>
  );
}

function StepRail({ current }: { current: StepKey }) {
  const currentIdx = stepIndex(current);
  const pct = Math.round((currentIdx / (ONBOARDING_STEPS.length - 1)) * 100);

  return (
    <aside className="onb-rail">
      <div className="onb-rail-brand">
        <AqliMark size={22} />
        <span>aqli</span>
      </div>

      {/* Compact progress for narrow screens, where the full list is hidden. */}
      <div className="onb-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="onb-progress-bar" style={{ width: `${pct}%` }} />
      </div>
      {/* No workspace name here — the top bar already carries it, and on narrow
          screens the two sit within a few pixels of each other. */}
      <div className="onb-progress-label">
        {`Step ${currentIdx + 1} of ${NUMBERED_STEPS.length}`}
      </div>

      <div className="onb-rail-head">
        <div className="onb-rail-eyebrow">Set up</div>
        <div className="onb-rail-time">About 2 minutes</div>
      </div>

      <ol className="onb-steps">
        {ONBOARDING_STEPS.map((s, i) => {
          const done = i < currentIdx;
          const now = i === currentIdx;
          return (
            <li key={s.key} className={`onb-step${now ? " is-now" : ""}${done ? " is-done" : ""}`} aria-current={now ? "step" : undefined}>
              <span className="onb-step-dot">{done ? <IconCheck size={12} /> : i + 1}</span>
              <span className="onb-step-copy">
                <span className="onb-step-label">{s.label}</span>
                <span className="onb-step-hint">{s.hint}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="onb-rail-foot">
        <span>Open source · MIT</span>
        <span>github.com/AAALI/aqli</span>
      </div>
    </aside>
  );
}

function Stage({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow?: string | null;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="onb-head">
        {eyebrow && <div className="onb-eyebrow">{eyebrow}</div>}
        <h1 className="onb-title">{title}</h1>
        {sub && <p className="onb-sub">{sub}</p>}
      </header>
      {children}
    </>
  );
}

function Footer({ left, right }: { left?: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="onb-footer">
      <div className="onb-footer-left">{left}</div>
      <div className="onb-footer-right">{right}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="onb-field">
      <span className="onb-field-label">{label}</span>
      {children}
      {error ? (
        <span className="onb-field-error">
          <IconWarn size={12} /> {error}
        </span>
      ) : hint ? (
        <span className="onb-field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  prefix,
  mono,
  type = "text",
  required,
  autoFocus,
  minLength,
  onEnter,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  mono?: boolean;
  type?: string;
  required?: boolean;
  autoFocus?: boolean;
  minLength?: number;
  onEnter?: () => void;
  invalid?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <span
      className={`onb-input${focused ? " is-focused" : ""}${invalid ? " is-invalid" : ""}`}
      onClick={() => ref.current?.focus()}
    >
      {prefix && <span className="onb-input-prefix">{prefix}</span>}
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        minLength={minLength}
        style={{ fontFamily: mono ? "var(--font-mono)" : "inherit", fontSize: mono ? 13 : 14 }}
        onKeyDown={
          onEnter
            ? (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onEnter();
                }
              }
            : undefined
        }
      />
    </span>
  );
}

function Panel({ tone, children }: { tone?: "ok"; children: React.ReactNode }) {
  return <div className={`onb-panel${tone === "ok" ? " is-ok" : ""}`}>{children}</div>;
}

function PanelRow({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone?: "ok";
  children: React.ReactNode;
}) {
  return (
    <div className="onb-panel-row">
      <span className={`onb-panel-icon${tone === "ok" ? " is-ok" : ""}`}>{icon}</span>
      <div className="onb-panel-copy">{children}</div>
    </div>
  );
}

function Msg({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  return <p className={`onb-msg is-${tone}`}>{children}</p>;
}

