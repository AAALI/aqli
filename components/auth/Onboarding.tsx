"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AqliMark } from "@/components/aqli/AqliMark";
import { IconCheck, IconKey, IconFolder, IconRobot, IconSparkle } from "@/components/aqli/icons";
import { slugify } from "@/lib/utils";

type StepKey = "account" | "workspace" | "spaces" | "agent" | "done";

const STEPS: { key: StepKey; n: number; label: string; hint: string }[] = [
  { key: "account", n: 1, label: "Account", hint: "Email + password" },
  { key: "workspace", n: 2, label: "Workspace", hint: "Team or org" },
  { key: "spaces", n: 3, label: "Spaces", hint: "How docs are organised" },
  { key: "agent", n: 4, label: "Agent", hint: "API key for AI" },
  { key: "done", n: 5, label: "Open workspace", hint: "You're set" },
];

const SUGGESTED = [
  { emoji: "📋", name: "Product", desc: "PRDs, decisions, roadmap" },
  { emoji: "⚙️", name: "Engineering", desc: "ADRs, runbooks, fix notes" },
  { emoji: "🛡️", name: "Trust & Safety", desc: "Policies, hold rules, audit" },
  { emoji: "🔧", name: "Ops", desc: "Runbooks, incident reports" },
  { emoji: "🏢", name: "Company", desc: "Handbook, onboarding" },
];

export default function Onboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [step, setStep] = useState<StepKey>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null);
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>(["Product", "Engineering", "Trust & Safety"]);
  const [agentName, setAgentName] = useState("Claude Code");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // If already signed in (e.g. /signup?step=workspace), skip the account step.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? "");
        setStep((s) => (s === "account" ? "workspace" : s));
      } else if (searchParams.get("step") === "workspace") {
        setStep("workspace");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveSlug = slugTouched ? slugify(slug) : slugify(workspaceName);

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        setNotice("Account created. Check your email to confirm, then log in to finish setup.");
        return;
      }
      setStep("workspace");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function submitWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName, slug: effectiveSlug }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Could not create workspace");
      }
      const { workspace } = await res.json();
      setWorkspaceId(workspace.id);
      setWorkspaceSlug(workspace.slug);
      // Default spaces are created by the workspace RPC — fetch them so we can
      // show what already exists and only create the extras the user picks.
      try {
        const sres = await fetch(`/api/spaces?workspace_id=${workspace.id}`);
        const { spaces } = await sres.json();
        const names = (spaces ?? []).map((s: { name: string }) => s.name);
        setExistingNames(names);
        setPicked((p) => Array.from(new Set([...names, ...p])));
      } catch {
        /* non-fatal */
      }
      setStep("spaces");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function submitSpaces() {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    try {
      const toCreate = SUGGESTED.filter((s) => picked.includes(s.name) && !existingNames.includes(s.name));
      await Promise.all(
        toCreate.map((s) =>
          fetch("/api/spaces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspace_id: workspaceId, name: s.name, icon: s.emoji }),
          }),
        ),
      );
      setStep("agent");
    } catch {
      setStep("agent"); // non-fatal — spaces are optional
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    if (workspaceSlug) {
      router.push(`/w/${workspaceSlug}`);
      router.refresh();
    }
  }

  function toggleSpace(name: string) {
    if (existingNames.includes(name)) return; // can't remove already-created defaults
    setPicked((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", minHeight: "100vh", background: "var(--bg-base)", fontFamily: "var(--font-sans)" }}>
      <StepRail currentKey={step} />
      <Stage>
        {step === "account" && (
          <StageInner
            eyebrow="Step 1 of 5"
            title="Set up your account."
            sub="Aqli is the shared context layer for human–agent teams. You'll be writing in under five minutes."
            topRight={<span>Already have an account? <Link href="/login" style={{ color: "var(--accent)", fontWeight: 500, textDecoration: "none" }}>Log in</Link></span>}
          >
            <form onSubmit={submitAccount} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Field label="Work email">
                <TextInput type="email" value={email} onChange={setEmail} placeholder="you@team.com" required />
              </Field>
              <Field label="Password" hint="At least 6 characters. We never see it.">
                <TextInput type="password" value={password} onChange={setPassword} placeholder="••••••••••••" minLength={6} required />
              </Field>
              {error && <Msg tone="error">{error}</Msg>}
              {notice && <Msg tone="ok">{notice}</Msg>}
              <Footer
                right={<button type="submit" className="btn btn-primary" style={{ height: 38, padding: "0 18px" }} disabled={busy}>{busy ? "Creating…" : "Continue →"}</button>}
                left={<span style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 320 }}>By continuing you agree to the Terms and Privacy policy.</span>}
              />
            </form>
          </StageInner>
        )}

        {step === "workspace" && (
          <StageInner
            eyebrow="Step 2 of 5"
            title="Name your workspace."
            sub="One workspace per team or organisation. You can rename it later."
            topRight={email ? <span>Signed in as <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{email}</strong></span> : null}
          >
            <form onSubmit={submitWorkspace} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Field label="Workspace name">
                <TextInput value={workspaceName} onChange={(v) => setWorkspaceName(v)} placeholder="e.g. Tabadulat" required autoFocus />
              </Field>
              <Field label="Workspace URL" hint="Used for share links and the agent API base URL.">
                <TextInput mono prefix="aqli.app /" value={slugTouched ? slug : effectiveSlug} onChange={(v) => { setSlug(v); setSlugTouched(true); }} placeholder="tabadulat" />
              </Field>
              <div style={{ padding: "16px 18px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-card)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ color: "var(--accent)", marginTop: 1 }}><IconSparkle size={16} /></span>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  We&apos;ll set up your workspace with a few default spaces. Your team and agents share this one source of truth.
                </div>
              </div>
              {error && <Msg tone="error">{error}</Msg>}
              <Footer
                left={<button type="button" className="btn btn-ghost" onClick={() => setStep("account")} style={{ height: 38 }}>← Back</button>}
                right={<button type="submit" className="btn btn-primary" style={{ height: 38, padding: "0 18px" }} disabled={busy || !workspaceName.trim()}>{busy ? "Creating…" : "Continue →"}</button>}
              />
            </form>
          </StageInner>
        )}

        {step === "spaces" && (
          <StageInner
            eyebrow="Step 3 of 5"
            title="What lives where?"
            sub="Spaces are how Aqli organises docs. Start with what fits — add or remove anytime."
            topRight={workspaceName ? <span>Workspace <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{workspaceName}</strong></span> : null}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SUGGESTED.map((s) => {
                const on = picked.includes(s.name);
                const locked = existingNames.includes(s.name);
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => toggleSpace(s.name)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                      border: `1px solid ${on ? "rgba(15,110,86,0.2)" : "var(--border)"}`,
                      borderRadius: 8, background: on ? "rgba(15,110,86,0.04)" : "var(--bg-card)",
                      cursor: locked ? "default" : "pointer", textAlign: "left", fontFamily: "var(--font-sans)",
                    }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: 4, border: on ? "1.5px solid var(--accent)" : "1.5px solid var(--border-strong)", background: on ? "var(--accent)" : "var(--bg-card)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 18px" }}>
                      {on && <IconCheck size={12} />}
                    </span>
                    <span style={{ fontSize: 18, lineHeight: 1, filter: "saturate(0.85)" }}>{s.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{s.name}{locked && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>added</span>}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {error && <Msg tone="error">{error}</Msg>}
            <Footer
              left={<span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{picked.length} selected</span>}
              right={<button type="button" className="btn btn-primary" style={{ height: 38, padding: "0 18px" }} onClick={submitSpaces} disabled={busy}>{busy ? "Creating…" : "Continue →"}</button>}
            />
          </StageInner>
        )}

        {step === "agent" && (
          <StageInner
            eyebrow="Step 4 of 5"
            title="Connect your first agent."
            sub="An API key lets Claude Code, Cursor, or any agent query Aqli for context and write back what they did. You can do this later from Settings."
            topRight={workspaceName ? <span>Workspace <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{workspaceName}</strong></span> : null}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Agent name" hint="So you can recognise it in audit logs.">
                <TextInput value={agentName} onChange={setAgentName} placeholder="Claude Code · monorepo" />
              </Field>
              <div style={{ padding: "16px 18px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--accent)" }}><IconKey size={14} /></span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-secondary)" }}>API key</span>
                  <span className="badge badge-review" style={{ marginLeft: "auto" }}>Set up later</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  Generate a workspace-scoped API key any time from <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Settings → API Keys</strong>. Agents authenticate with it to read approved context and submit drafts for review.
                </div>
              </div>
            </div>
            <Footer
              left={<button type="button" className="btn btn-ghost" onClick={() => setStep("spaces")} style={{ height: 38 }}>← Back</button>}
              right={
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setStep("done")} style={{ height: 38 }}>Skip for now</button>
                  <button type="button" className="btn btn-primary" style={{ height: 38, padding: "0 18px" }} onClick={() => setStep("done")}>Continue →</button>
                </div>
              }
            />
          </StageInner>
        )}

        {step === "done" && (
          <StageInner
            eyebrow="All set"
            title={`Welcome to Aqli.`}
            sub={`Your workspace is live at aqli.app/${workspaceSlug ?? ""}. The next move is yours.`}
            topRight={workspaceName ? <span>Workspace <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{workspaceName}</strong></span> : null}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SummaryRow icon={<IconFolder />} label="Spaces" value={picked.join(" · ") || "Default spaces"} />
              <SummaryRow icon={<IconRobot />} label="Workspace URL" value={`aqli.app/${workspaceSlug ?? ""}`} meta="Live" />
              <SummaryRow icon={<IconKey />} label="Agent" value={agentName} meta="Add key in Settings" />
            </div>
            <Footer
              left={<span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>You can change any of this later.</span>}
              right={<button type="button" className="btn btn-primary" style={{ height: 38, padding: "0 18px" }} onClick={finish}>Open workspace →</button>}
            />
          </StageInner>
        )}
      </Stage>
    </div>
  );
}

function StepRail({ currentKey }: { currentKey: StepKey }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentKey);
  return (
    <aside style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "36px 32px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
        <AqliMark size={22} />
        <span style={{ fontSize: 17, letterSpacing: "0.08em", fontWeight: 500, color: "var(--text-primary)" }}>aqli</span>
      </div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Set up</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>About 3 minutes</div>
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
        {STEPS.map((s, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <li key={s.key} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "10px 0" }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: isDone ? "var(--accent)" : isCurrent ? "var(--bg-card)" : "transparent", border: isCurrent || isDone ? "1.5px solid var(--accent)" : "1.5px solid var(--border-strong)", color: isDone ? "#fff" : isCurrent ? "var(--accent)" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flex: "0 0 22px", marginTop: 1 }}>
                {isDone ? <IconCheck size={12} /> : s.n}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: isCurrent ? 500 : 400, color: isCurrent ? "var(--text-primary)" : isDone ? "var(--text-secondary)" : "var(--text-muted)", lineHeight: 1.25 }}>{s.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.25 }}>{s.hint}</div>
              </div>
            </li>
          );
        })}
      </ol>
      <div style={{ marginTop: "auto", fontSize: 12.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
        <span>docs.aqli.app</span>
        <span>github.com/AAALI/aqli</span>
      </div>
    </aside>
  );
}

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: "var(--bg-base)", display: "flex", flexDirection: "column", position: "relative" }}>
      {children}
    </div>
  );
}

function StageInner({
  eyebrow,
  title,
  sub,
  topRight,
  children,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  topRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div style={{ height: 56, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "flex-end", fontSize: 12.5, color: "var(--text-muted)" }}>
        {topRight}
      </div>
      <div style={{ flex: 1, padding: "12px 40px 56px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
        <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 32 }}>
          <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {eyebrow && <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)" }}>{eyebrow}</div>}
            <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 40, lineHeight: 1.05, fontWeight: 400, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>{title}</h1>
            {sub && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--text-secondary)", maxWidth: 520 }}>{sub}</p>}
          </header>
          {children}
        </div>
      </div>
    </>
  );
}

function Footer({ left, right }: { left?: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{hint}</span>}
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
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 42, padding: "0 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-card)", fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)" }}>
      {prefix && <span style={{ color: "var(--text-muted)", fontSize: 13, marginRight: 6 }}>{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        minLength={minLength}
        style={{ flex: 1, border: 0, outline: 0, background: "transparent", fontFamily: "inherit", fontSize: mono ? 13 : 14, color: "var(--text-primary)" }}
      />
    </div>
  );
}

function Msg({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 13, color: tone === "error" ? "#993C1D" : "var(--approved-text)" }}>{children}</p>
  );
}

function SummaryRow({ icon, label, value, meta }: { icon: React.ReactNode; label: string; value: string; meta?: string }) {
  return (
    <div style={{ padding: "12px 16px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-card)", display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 32px" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      </div>
      {meta && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-muted)" }}>{meta}</span>}
      <span style={{ color: "var(--accent)" }}><IconCheck size={16} /></span>
    </div>
  );
}
