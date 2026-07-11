"use client";

// Landing page · The Aqli Loop — playable five-step walkthrough of the
// agent-augmented knowledge loop. Auto-advances, pauses on hover,
// clickable step tabs. Ported from the LP1 design handoff.
//
// Performance: React state changes only once per step (every 5.2s).
// All intra-step motion — reveals, the pill progress fill, the connector
// pulse — is pure CSS animation (keyframes in globals.css), so nothing
// re-renders per frame. Hovering pauses via `animation-play-state` plus
// the step timer.

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

import { AqliMark } from "@/components/aqli/AqliMark";
import {
  IconCheck,
  IconCheckCircle,
  IconGitHub,
  IconGitMerge,
  IconRobot,
  IconSparkle,
  IconWand,
} from "@/components/aqli/icons";
import { useIsMobile } from "./useIsMobile";

// ─────────────────────────────────────────────────────────────────────
// Step content
// ─────────────────────────────────────────────────────────────────────

type FlowStepId = "ask" | "read" | "draft" | "review" | "know";

type FlowStepDef = {
  id: FlowStepId;
  eyebrow: string;
  title: string;
  body: string;
  url: string;
};

const FLOW_STEPS: FlowStepDef[] = [
  {
    id: "ask",
    eyebrow: "01 · The trigger",
    title: "A question shows up — or a PR lands.",
    body: "Aqli watches the places knowledge actually starts: questions asked in your workspace and pull requests merging into your codebase.",
    url: "github.com/acme/banking-core · pull/1247",
  },
  {
    id: "read",
    eyebrow: "02 · Grounding",
    title: "The agent reads only what's approved.",
    body: "Through one context endpoint, your agent pulls the exact chunks of canonical knowledge it needs — no scraping, no stale wikis, no leaks.",
    url: "aqli.app/api/agent/context",
  },
  {
    id: "draft",
    eyebrow: "03 · Co-writing",
    title: "Co-write drafts with citations inline.",
    body: "The agent drafts a section in your editor, suggests quotes from approved docs, and waits for you to accept — line by line.",
    url: "acme.aqli.app/engineering/ach-r09-routing",
  },
  {
    id: "review",
    eyebrow: "04 · The human call",
    title: "One click. Diff, provenance, and decision.",
    body: "Every agent draft lands in the review queue with a one-tap Approve / Request changes / Reject. No more guessing what was generated — every decision is logged.",
    url: "acme.aqli.app/review/2491",
  },
  {
    id: "know",
    eyebrow: "05 · The compound effect",
    title: "Approved → part of the corpus. Cited by the next draft.",
    body: "Every approval enriches the library. The next teammate — or the next agent — gets a sharper answer with citations, backlinks, and a freshness signal.",
    url: "acme.aqli.app/engineering/ach-r09-routing",
  },
];

const STEP_DURATION_MS = 5200;

// CSS reveal helper — element animates in after `delayMs` from stage mount
const reveal = (delayMs: number, anim = "lpReveal", durMs = 360): CSSProperties => ({
  animation: `${anim} ${durMs}ms ease ${delayMs}ms both`,
});

// Reduced-motion preference as an external store (SSR default: no preference)
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const getReducedMotionServer = () => false;

// ─────────────────────────────────────────────────────────────────────
// Main interactive shell
// ─────────────────────────────────────────────────────────────────────

export function FlowDemo() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  // Always auto-plays. Reduced-motion users navigate via the pills.
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getReducedMotionServer);
  const playing = !reducedMotion && !paused;
  const isMobile = useIsMobile();

  // Step timer. CSS animations carry all intra-step motion; this only
  // advances the step. Pause must survive across hover, so we track how
  // much of the current step already elapsed.
  const pausedElapsedRef = useRef(0);
  const advancedRef = useRef(false);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now() - pausedElapsedRef.current;
    const id = setTimeout(() => {
      advancedRef.current = true;
      setStep((s) => (s + 1) % FLOW_STEPS.length);
    }, Math.max(0, STEP_DURATION_MS - pausedElapsedRef.current));
    return () => {
      clearTimeout(id);
      if (advancedRef.current) {
        // Natural advance: next step starts from zero
        advancedRef.current = false;
        pausedElapsedRef.current = 0;
      } else {
        // Paused (hover) — remember where we were
        pausedElapsedRef.current = Math.min(STEP_DURATION_MS, performance.now() - startedAt);
      }
    };
  }, [playing, step]);

  const goto = (i: number) => {
    if (i === step) return;
    if (playing) {
      advancedRef.current = true; // tell the cleanup this is a jump, not a pause
    } else {
      pausedElapsedRef.current = 0;
    }
    setStep(i);
  };

  return (
    <section
      id="loop"
      className={paused ? "lp-flow-paused" : undefined}
      style={{
        padding: isMobile ? "16px 16px 64px" : "16px 56px 96px",
        display: "flex",
        justifyContent: "center",
        position: "relative",
        cursor: paused ? "pointer" : undefined,
      }}
      onClick={() => setPaused((p) => !p)}
    >
      {/* Soft glow — the gradient is its own blur; a filter here doubles paint cost */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -42%)",
          width: 1180,
          height: 520,
          maxWidth: "100%",
          background:
            "radial-gradient(ellipse at center, rgba(15,110,86,0.12) 0%, rgba(15,110,86,0.05) 45%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: 1240, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Caption block — eyebrow + sentence */}
        <FlowCaption step={FLOW_STEPS[step]} index={step} />

        {/* Stage */}
        <BrowserFrame url={FLOW_STEPS[step].url}>
          <FlowStage stepId={FLOW_STEPS[step].id} isMobile={isMobile} />
        </BrowserFrame>

        {/* Step rail */}
        <FlowStepRail steps={FLOW_STEPS} current={step} onGoto={goto} isMobile={isMobile} />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Browser frame around the stage
// ─────────────────────────────────────────────────────────────────────

function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        boxShadow:
          "0 24px 60px -24px rgba(20,20,18,0.25), 0 4px 12px rgba(20,20,18,0.06)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Chrome */}
      <div
        style={{
          height: 40,
          padding: "0 14px",
          background: "var(--bg-sidebar)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <ChromeDot color="#E15D5D" />
          <ChromeDot color="#E9B048" />
          <ChromeDot color="#54B26A" />
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            maxWidth: 520,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 26,
            padding: "0 12px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 11.5,
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span style={{ color: "var(--accent)", flexShrink: 0 }}>🔒</span>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{url}</span>
        </div>
        <div style={{ width: 52, flexShrink: 0 }} />
      </div>
      {children}
    </div>
  );
}

function ChromeDot({ color }: { color: string }) {
  return <span style={{ width: 11, height: 11, borderRadius: 999, background: color }} />;
}

// ─────────────────────────────────────────────────────────────────────
// Caption + step rail
// ─────────────────────────────────────────────────────────────────────

function FlowCaption({ step, index }: { step: FlowStepDef; index: number }) {
  return (
    <div
      key={index}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        maxWidth: 760,
        animation: "lpFadeUp 480ms cubic-bezier(.2,.7,.2,1) both",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--accent)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {step.eyebrow}
      </div>
      <h3
        style={{
          margin: 0,
          fontFamily: "var(--font-serif)",
          fontWeight: 400,
          fontSize: 28,
          letterSpacing: "-0.015em",
          lineHeight: 1.15,
          color: "var(--text-primary)",
          textWrap: "balance",
        }}
      >
        {step.title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 14.5,
          lineHeight: 1.6,
          color: "var(--text-secondary)",
          maxWidth: 660,
        }}
      >
        {step.body}
      </p>
    </div>
  );
}

function FlowStepRail({
  steps,
  current,
  onGoto,
  isMobile,
}: {
  steps: FlowStepDef[];
  current: number;
  onGoto: (i: number) => void;
  isMobile: boolean;
}) {
  if (isMobile) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "12px 4px 0" }}>
        {steps.map((s, i) => {
          const isDone = i < current;
          const isCurrent = i === current;
          return (
            <button
              key={s.id}
              onClick={() => onGoto(i)}
              style={{
                position: "relative",
                width: 32,
                height: 32,
                borderRadius: 999,
                background: isDone || isCurrent ? "var(--accent)" : "var(--bg-card)",
                border: `1px solid ${isDone || isCurrent ? "var(--accent)" : "var(--border-strong)"}`,
                color: isDone || isCurrent ? "#fff" : "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                overflow: "hidden",
                boxShadow: isCurrent ? "0 0 0 4px rgba(15,110,86,0.12)" : "none",
              }}
            >
              {isCurrent && (
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    transformOrigin: "left",
                    background: "rgba(255,255,255,0.18)",
                    animation: `lpFill ${STEP_DURATION_MS}ms linear both`,
                    pointerEvents: "none",
                  }}
                />
              )}
              {isDone ? <IconCheck size={12} sw={2.4} /> : String(i + 1).padStart(2, "0")}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 4px 0" }}>
      {/* Step pills */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
          gap: 8,
        }}
      >
        {steps.map((s, i) => (
          <StepPill
            key={s.id}
            n={String(i + 1).padStart(2, "0")}
            label={PILL_LABELS[s.id]}
            state={i < current ? "done" : i === current ? "current" : "todo"}
            onClick={() => onGoto(i)}
          />
        ))}
      </div>
    </div>
  );
}

const PILL_LABELS: Record<FlowStepId, string> = {
  ask: "Question lands",
  read: "Aqli reads context",
  draft: "Agent drafts",
  review: "Human approves",
  know: "Knowledge compounds",
};

function StepPill({
  n,
  label,
  state,
  onClick,
}: {
  n: string;
  label: string;
  state: "done" | "current" | "todo";
  onClick: () => void;
}) {
  const isCurrent = state === "current";
  const isDone = state === "done";
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        background: isCurrent ? "var(--bg-card)" : "transparent",
        border: `1px solid ${isCurrent ? "var(--border-strong)" : "var(--border)"}`,
        borderRadius: 8,
        cursor: "pointer",
        textAlign: "left",
        overflow: "hidden",
      }}
    >
      {/* Progress fill — CSS-driven, one full sweep per step */}
      {isCurrent && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "100%",
            transformOrigin: "left",
            background: "var(--accent-light)",
            animation: `lpFill ${STEP_DURATION_MS}ms linear both`,
            pointerEvents: "none",
          }}
        />
      )}
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: isDone || isCurrent ? "var(--accent)" : "var(--bg-card)",
          border: `1px solid ${isDone || isCurrent ? "var(--accent)" : "var(--border-strong)"}`,
          color: isDone || isCurrent ? "#fff" : "var(--text-muted)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 600,
          flex: "0 0 22px",
          zIndex: 1,
          boxShadow: isCurrent ? "0 0 0 4px rgba(15,110,86,0.10)" : "none",
        }}
      >
        {isDone ? <IconCheck size={11} sw={2.4} /> : n}
      </span>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: isCurrent ? 500 : 400,
          color: isCurrent ? "var(--text-primary)" : "var(--text-secondary)",
          zIndex: 1,
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          overflow: "hidden",
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Stage switcher
// ─────────────────────────────────────────────────────────────────────

function FlowStage({ stepId, isMobile }: { stepId: FlowStepId; isMobile: boolean }) {
  const StageComp = {
    ask: FlowStage_Ask,
    read: FlowStage_Read,
    draft: FlowStage_Draft,
    review: FlowStage_Review,
    know: FlowStage_Know,
  }[stepId];
  return (
    <div
      key={stepId}
      style={{
        height: isMobile ? "auto" : 520,
        background: "var(--bg-base)",
        position: "relative",
        overflow: "hidden",
        contain: isMobile ? undefined : "layout paint",
        animation: "lpStageIn 520ms cubic-bezier(.2,.7,.2,1) both",
      }}
    >
      <StageComp isMobile={isMobile} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STAGE 01 · Question lands  (PR + Slack thread feeding Aqli)
// ─────────────────────────────────────────────────────────────────────

function FlowStage_Ask({ isMobile }: { isMobile: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: isMobile ? "auto" : "100%",
        display: isMobile ? "flex" : "grid",
        flexDirection: isMobile ? "column" : undefined,
        gridTemplateColumns: isMobile ? undefined : "1fr 200px 1fr",
        alignItems: isMobile ? undefined : "center",
        padding: isMobile ? "20px 16px 24px" : "0 56px",
        gap: isMobile ? 12 : 0,
      }}
    >
      {/* Left — two source cards stacked */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* PR card */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            boxShadow: "0 6px 18px -10px rgba(20,20,18,0.10)",
            ...reveal(260),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "#1F2328",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconGitHub size={12} />
            </span>
            <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              acme/banking-core
            </span>
            <span
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(130,80,223,0.12)",
                color: "#6F3FD0",
                fontSize: 10.5,
                fontWeight: 600,
              }}
            >
              <IconGitMerge size={10} sw={2} /> MERGED
            </span>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>
            Fix: ACH return code R09 routing
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            #1247 · 8 commits · merged 12s ago by Khalid
          </div>
        </div>

        {/* Slack-ish thread */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            boxShadow: "0 6px 18px -10px rgba(20,20,18,0.10)",
            ...reveal(1820),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "linear-gradient(135deg,#E58A4F,#C45B2C)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              S
            </span>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Sara</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>#payments-engineering · 2m</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
            Hey — anyone know what we do with ACH R09 returns? Customer keeps bouncing and I can&apos;t find the
            routing rule.
          </div>
        </div>
      </div>

      {/* Center — flowing connection (desktop only) */}
      {!isMobile && <FlowConnector />}

      {/* Right — Aqli node receiving */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 20px",
            background: "var(--bg-card)",
            border: "1px solid var(--accent)",
            borderRadius: 12,
            boxShadow: "0 16px 36px -16px rgba(15,110,86,0.40)",
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "var(--accent)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AqliMark size={16} color="#fff" />
          </span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Aqli intercepts
            </span>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--text-primary)" }}>
              New work item
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "12px 14px",
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            width: "100%",
            ...reveal(2860, "lpRevealFade", 480),
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              color: "var(--text-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Decision
          </span>
          <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>
            PR merged → auto-create doc, route to <strong>Engineering</strong>, attribute to <strong>Khalid</strong>.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STAGE 02 · Aqli reads approved context (context API call + retrieved chunks)
// ─────────────────────────────────────────────────────────────────────

function FlowStage_Read({ isMobile }: { isMobile: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: isMobile ? "auto" : "100%",
        display: isMobile ? "flex" : "grid",
        flexDirection: isMobile ? "column" : undefined,
        gridTemplateColumns: isMobile ? undefined : "1.05fr 200px 1fr",
        alignItems: isMobile ? undefined : "center",
        padding: isMobile ? "20px 16px 24px" : "0 56px",
        gap: isMobile ? 16 : 0,
      }}
    >
      {/* Left — context API call */}
      <div
        style={{
          background: "#1A1916",
          border: "1px solid #2C2A26",
          borderRadius: 10,
          padding: "18px 22px",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.65,
          color: "#E8E6DF",
          boxShadow: "0 20px 48px -20px rgba(20,20,18,0.40)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
            fontFamily: "var(--font-sans)",
            fontSize: 11.5,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              background: "var(--agent-tint)",
              color: "var(--agent-icon)",
              border: "1px solid var(--agent-border)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconRobot size={11} />
          </span>
          Claude Code · acme/banking-core
        </div>

        <CodeLine delay={260}>
          <span style={{ color: "#9CC2A8" }}>GET</span>{" "}
          <span style={{ color: "#E8E6DF" }}>https://aqli.app/api/agent/context</span>
        </CodeLine>
        <CodeLine delay={936}>
          <span style={{ color: "rgba(255,255,255,0.50)" }}>Authorization:</span>{" "}
          <span style={{ color: "#E5A75A" }}>Bearer aqli_live_8a3f…</span>
        </CodeLine>
        <CodeLine delay={1560}>
          <span style={{ color: "rgba(255,255,255,0.50)" }}>q:</span>{" "}
          <span style={{ color: "#E5A75A" }}>&quot;ACH return code R09 routing policy&quot;</span>
        </CodeLine>
        <CodeLine delay={2184}>
          <span style={{ color: "rgba(255,255,255,0.50)" }}>scope:</span>{" "}
          <span style={{ color: "#E5A75A" }}>&quot;approved&quot;</span>{" "}
          <span style={{ color: "rgba(255,255,255,0.30)" }}>{"// no drafts"}</span>
        </CodeLine>

        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px dashed rgba(255,255,255,0.15)",
            ...reveal(2860, "lpRevealFade", 240),
          }}
        >
          <span style={{ color: "#9CC2A8" }}>→ 200 OK</span>{" "}
          <span style={{ color: "rgba(255,255,255,0.55)" }}>· 4 chunks · 142 tokens</span>
        </div>
      </div>

      {/* Connector (desktop only) */}
      {!isMobile && <FlowConnector reverse />}

      {/* Right — retrieved chunks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          Approved chunks returned
        </div>
        {READ_CHUNKS.map((c, i) => (
          <ChunkCard key={i} chunk={c} delay={2340 + i * 520} />
        ))}
      </div>
    </div>
  );
}

type ReadChunk = { doc: string; section: string; verified: string };

const READ_CHUNKS: ReadChunk[] = [
  { doc: "ACH Return Codes · Runbook", section: "§ R09 — Insufficient funds", verified: "12d ago" },
  { doc: "Payout Retry Policy · ADR v3", section: "§ Bounce-and-retry windows", verified: "4d ago" },
  { doc: "Customer Comms · Returns", section: "§ Email template R09", verified: "21d ago" },
];

function ChunkCard({ chunk, delay }: { chunk: ReadChunk; delay: number }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        ...reveal(delay, "lpRevealX"),
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-primary)" }}>{chunk.doc}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "var(--font-serif)" }}>
        {chunk.section}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10.5,
          color: "var(--text-muted)",
          marginTop: 2,
        }}
      >
        <span style={{ display: "inline-flex", color: "var(--approved-text)" }}>
          <IconCheckCircle size={10} sw={2} />
        </span>
        Approved · verified {chunk.verified}
      </div>
    </div>
  );
}

function CodeLine({ delay, children }: { delay: number; children: ReactNode }) {
  return (
    <div style={{ whiteSpace: "nowrap", ...reveal(delay, "lpRevealCode", 280) }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STAGE 03 · Agent drafts in the editor (floating Co-write chat)
// ─────────────────────────────────────────────────────────────────────

// Draft lines appear at quarter-steps; the caret rides the latest line
const DRAFT_LINE_AT = [0, 1300, 2600];
const CARET_OFF_AT = [1300, 2600, 3900];

function FlowStage_Draft({ isMobile }: { isMobile: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: isMobile ? "auto" : "100%",
        display: isMobile ? "flex" : "grid",
        flexDirection: isMobile ? "column" : undefined,
        gridTemplateColumns: isMobile ? undefined : "1fr 360px",
        gap: isMobile ? 16 : 24,
        padding: isMobile ? "20px 16px 24px" : "28px 36px 32px",
        position: "relative",
      }}
    >
      {/* Editor article */}
      <article
        style={{
          background: "var(--bg-base)",
          padding: "12px 4px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          fontFamily: "var(--font-sans)",
          color: "var(--text-primary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 3,
              background: "var(--bg-sidebar)",
              border: "1px solid var(--border)",
              letterSpacing: "0.04em",
              color: "var(--text-secondary)",
            }}
          >
            FIX NOTE
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "1px 8px",
              borderRadius: 999,
              background: "var(--draft-bg)",
              border: "1px solid var(--draft-border)",
              color: "var(--draft-text)",
              fontSize: 10,
              fontWeight: 500,
            }}
          >
            Draft
          </span>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Engineering · v1</span>
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: 32,
            lineHeight: 1.08,
            letterSpacing: "-0.018em",
          }}
        >
          Fix: ACH return code R09 routing
        </h1>

        <h2
          style={{
            margin: "18px 0 4px",
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: 18,
            display: "flex",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>§1</span>
          <span>What happened</span>
        </h2>

        {/* Lines */}
        <DraftLine showAt={DRAFT_LINE_AT[0]} caretOffAt={CARET_OFF_AT[0]}>
          When the bank returns an ACH transaction with code R09 (insufficient funds), the payment processor was
          routing the failure to the generic retry queue instead of the R09-specific cooldown bucket.
        </DraftLine>

        <DraftLine showAt={DRAFT_LINE_AT[1]} caretOffAt={CARET_OFF_AT[1]}>
          <span>This fix reroutes R09 returns into the </span>
          <Cited>bounce-and-retry window</Cited>
          <span> from the </span>
          <Cited primary>Payout Retry Policy ADR v3</Cited>
          <span>, with the </span>
          <Cited>R09 email template</Cited>
          <span> firing on the second failure.</span>
        </DraftLine>

        <DraftLine showAt={DRAFT_LINE_AT[2]} caretOffAt={CARET_OFF_AT[2]}>
          The 24h cooldown matches the runbook policy and avoids stacking three retries inside one banking day.
        </DraftLine>
      </article>

      {/* Floating Co-write chat — exact same form as Editor v2 */}
      <div
        style={{
          position: isMobile ? "relative" : "absolute",
          bottom: isMobile ? undefined : 24,
          right: isMobile ? undefined : 24,
          width: isMobile ? "100%" : 340,
          background: "var(--bg-card)",
          border: "1px solid var(--border-strong)",
          borderRadius: 14,
          boxShadow: "0 24px 48px -12px rgba(20,20,18,0.22), 0 4px 12px rgba(20,20,18,0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--bg-base)",
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: "var(--accent)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconWand size={11} />
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)" }}>Co-write</span>
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Claude 4.5
          </span>
        </div>

        {/* agent suggestion */}
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              padding: "10px 12px",
              background: "var(--accent-light)",
              border: "1px solid rgba(15,110,86,0.20)",
              borderRadius: "14px 14px 14px 4px",
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "var(--text-primary)",
            }}
          >
            I drafted §1 with three citations from <strong>Payout Retry ADR v3</strong> and the{" "}
            <strong>ACH Runbook</strong>. Want me to draft §2 — &ldquo;Rollout plan&rdquo; — using the same pattern?
            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  height: 22,
                  padding: "0 9px",
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                <IconCheck size={10} sw={2.4} /> Yes — draft it
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 22,
                  padding: "0 9px",
                  color: "var(--text-muted)",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                Dismiss
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--bg-base)",
          }}
        >
          <span style={{ flex: 1 }}>Ask Co-write…</span>
          <kbd
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-muted)",
              padding: "0 5px",
              border: "1px solid var(--border)",
              borderRadius: 3,
            }}
          >
            ⌘J
          </kbd>
        </div>
      </div>
    </div>
  );
}

function DraftLine({
  showAt,
  caretOffAt,
  children,
}: {
  showAt: number;
  caretOffAt: number;
  children: ReactNode;
}) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 14,
        lineHeight: 1.7,
        color: "var(--text-primary)",
        ...reveal(showAt, "lpRevealFade", 240),
      }}
    >
      {children}
      <TypingCaret onAt={showAt} offAt={caretOffAt} />
    </p>
  );
}

// Blinks from the line's reveal until the next line starts; lpCaretOff is
// listed last so its forwards fill overrides the blink once it fires.
function TypingCaret({ onAt, offAt }: { onAt: number; offAt: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 2,
        height: "1em",
        background: "var(--accent)",
        marginLeft: 2,
        verticalAlign: "-0.18em",
        animation: `lpBlink 1.05s steps(1) ${onAt}ms infinite, lpCaretOff 1ms linear ${offAt}ms forwards`,
      }}
    />
  );
}

function Cited({ primary, children }: { primary?: boolean; children: ReactNode }) {
  return (
    <span
      style={{
        background: primary ? "rgba(15,110,86,0.16)" : "var(--bg-sidebar)",
        boxShadow: primary ? "inset 0 -2px 0 rgba(15,110,86,0.40)" : "none",
        padding: "0 3px",
        borderRadius: 2,
        color: primary ? "var(--accent)" : "var(--text-primary)",
        fontWeight: primary ? 500 : 400,
      }}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STAGE 04 · Human reviews & approves
// ─────────────────────────────────────────────────────────────────────

// Approve hint pulses from 40% in; the approval lands at 62%
const APPROVE_HINT_AT = 2080;
const APPROVED_AT = 3224;

function FlowStage_Review({ isMobile }: { isMobile: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: isMobile ? "auto" : "100%",
        display: isMobile ? "flex" : "grid",
        flexDirection: isMobile ? "column" : undefined,
        gridTemplateColumns: isMobile ? undefined : "1.2fr 1fr",
        gap: isMobile ? 16 : 28,
        padding: isMobile ? "20px 16px 24px" : "28px 44px",
      }}
    >
      {/* Left — diff card */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 3,
              background: "var(--bg-sidebar)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            FIX NOTE
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>
            Fix: ACH return code R09 routing
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            +24 / −7
          </span>
        </div>

        <div
          style={{
            padding: "12px 14px",
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <LpDiffLine kind="ctx">{"  When R09 is returned by the bank,"}</LpDiffLine>
          <LpDiffLine kind="del">{"- route to generic retry queue"}</LpDiffLine>
          <LpDiffLine kind="add">{"+ route to R09 bounce-and-retry bucket (ADR v3)"}</LpDiffLine>
          <LpDiffLine kind="add">{"+ fire R09 email template on 2nd failure"}</LpDiffLine>
          <LpDiffLine kind="ctx">{"  Cooldown remains 24h per runbook."}</LpDiffLine>
        </div>

        {/* Provenance */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            background: "var(--agent-tint)",
            border: "1px solid var(--agent-border)",
            borderRadius: 8,
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: "var(--bg-card)",
              color: "var(--agent-icon)",
              border: "1px solid var(--agent-border)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconRobot size={11} />
          </span>
          <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
            Drafted by <strong>Claude Code</strong> · Triggered by Sara&apos;s question in #payments-engineering ·
            Cites 3 approved docs
          </span>
        </div>
      </div>

      {/* Right — reviewer + decision */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center" }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Awaiting your decision
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: "linear-gradient(135deg, #2F7D62, #0F6E56)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            A
          </span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>Ali Al-Mansoori</span>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Reviewer · Engineering</span>
          </div>
        </div>

        {/* Decision row */}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <ReviewBtn kind="ghost" label="Reject" />
          <ReviewBtn kind="secondary" label="Request changes" />
          <ReviewBtn kind="primary" label="Approve" hint icon={<IconCheck size={12} sw={2.4} />} />
        </div>

        {/* Outcome — both states stacked; CSS cross-fades at APPROVED_AT */}
        <div style={{ display: "grid", marginTop: 6 }}>
          <div
            style={{
              gridArea: "1 / 1",
              padding: "12px 14px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12.5,
              color: "var(--text-muted)",
              animation: `lpSwapOut 280ms ease ${APPROVED_AT}ms forwards`,
            }}
          >
            Click <strong>Approve</strong> to publish — the agent learns from your decision.
          </div>
          <div
            style={{
              gridArea: "1 / 1",
              padding: "12px 14px",
              background: "var(--approved-bg)",
              border: "1px solid var(--approved-border)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12.5,
              color: "var(--approved-text)",
              fontWeight: 500,
              opacity: 0,
              animation: `lpSwapIn 280ms ease ${APPROVED_AT}ms forwards`,
            }}
          >
            <IconCheckCircle size={14} sw={2} /> Approved · v1 published · 3 docs now backlink this
          </div>
        </div>
      </div>
    </div>
  );
}

function LpDiffLine({ kind, children }: { kind: "add" | "del" | "ctx"; children: ReactNode }) {
  const map: Record<"add" | "del" | "ctx", { bg: string; color: string }> = {
    add: { bg: "rgba(15,110,86,0.10)", color: "var(--approved-text)" },
    del: { bg: "rgba(190,80,40,0.10)", color: "#993C1D" },
    ctx: { bg: "transparent", color: "var(--text-secondary)" },
  };
  const s = map[kind];
  return (
    <div style={{ background: s.bg, color: s.color, padding: "1px 6px", borderRadius: 3, whiteSpace: "pre" }}>
      {children}
    </div>
  );
}

function ReviewBtn({
  kind,
  label,
  hint,
  icon,
}: {
  kind: "primary" | "secondary" | "ghost";
  label: string;
  hint?: boolean;
  icon?: ReactNode;
}) {
  const styles: Record<"primary" | "secondary" | "ghost", { bg: string; color: string; border: string }> = {
    primary: { bg: "var(--accent)", color: "#fff", border: "var(--accent)" },
    secondary: { bg: "var(--bg-card)", color: "var(--text-primary)", border: "var(--border)" },
    ghost: { bg: "transparent", color: "var(--text-muted)", border: "transparent" },
  };
  const s = styles[kind];
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 34,
        padding: "0 14px",
        borderRadius: 7,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontSize: 12.5,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {/* Glow ring painted once; only its opacity animates */}
      {hint && (
        <span
          style={{
            position: "absolute",
            inset: -1,
            borderRadius: 7,
            boxShadow: "0 0 0 4px rgba(15,110,86,0.15)",
            opacity: 0,
            animation: `lpHintFade ${APPROVED_AT - APPROVE_HINT_AT}ms ease ${APPROVE_HINT_AT}ms both`,
            pointerEvents: "none",
          }}
        />
      )}
      {icon}
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STAGE 05 · Knowledge compounds (viewer + cited-by + trust line)
// ─────────────────────────────────────────────────────────────────────

function FlowStage_Know({ isMobile }: { isMobile: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: isMobile ? "auto" : "100%",
        display: isMobile ? "flex" : "grid",
        flexDirection: isMobile ? "column" : undefined,
        gridTemplateColumns: isMobile ? undefined : "1.4fr 320px",
        gap: 0,
        padding: 0,
      }}
    >
      {/* Doc viewer */}
      <article
        style={{
          padding: isMobile ? "20px 16px 24px" : "28px 44px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderRight: isMobile ? undefined : "1px solid var(--border)",
          borderBottom: isMobile ? "1px solid var(--border)" : undefined,
          background: "var(--bg-base)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 3,
              background: "var(--bg-sidebar)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            FIX NOTE
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "1px 8px",
              borderRadius: 999,
              background: "var(--approved-bg)",
              border: "1px solid var(--approved-border)",
              color: "var(--approved-text)",
              fontSize: 10,
              fontWeight: 500,
            }}
          >
            <IconCheck size={9} sw={2.4} /> Approved
          </span>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Engineering · v1 · 2 min ago</span>
        </div>
        <h1
          style={{
            margin: "4px 0 0",
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: 30,
            lineHeight: 1.1,
            letterSpacing: "-0.018em",
          }}
        >
          Fix: ACH return code R09 routing
        </h1>

        {/* Trust line */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            marginTop: 6,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 11.5,
            color: "var(--text-secondary)",
            width: "fit-content",
          }}
        >
          <span style={{ color: "var(--approved-text)", display: "inline-flex" }}>
            <IconCheckCircle size={12} sw={2} />
          </span>
          <span>
            <strong style={{ color: "var(--text-primary)" }}>Verified</strong> just now by Ali · cites 3 approved
            docs ·{" "}
          </span>
          <a style={{ color: "var(--accent)", fontWeight: 500, cursor: "pointer" }}>Re-verify in 30d</a>
        </div>

        <h2
          style={{
            margin: "20px 0 4px",
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: 18,
            display: "flex",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>§1</span>
          <span>What happened</span>
        </h2>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "var(--text-primary)" }}>
          When the bank returns an ACH transaction with code R09 (insufficient funds), the payment processor was
          routing the failure to the generic retry queue instead of the R09-specific cooldown bucket. This fix
          reroutes R09 returns into the <Cited primary>bounce-and-retry window</Cited> from the{" "}
          <Cited primary>Payout Retry Policy ADR v3</Cited>.
        </p>
      </article>

      {/* Right rail — Cited by */}
      <aside
        style={{
          background: "var(--bg-card)",
          padding: isMobile ? "20px 16px 24px" : "28px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "var(--accent)", display: "inline-flex" }}>
              <IconSparkle size={11} />
            </span>
            Already cited by
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {BACKLINKS.map((b, i) => (
              <BacklinkRow key={i} b={b} />
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)" }} />

        {/* Compound counter */}
        <div
          style={{
            padding: "14px 16px",
            background: "var(--accent-light)",
            border: "1px solid rgba(15,110,86,0.20)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            The loop
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-primary)" }}>
            One PR became canonical knowledge in <strong>~4 minutes</strong>. Next agent draft cites it
            automatically.
          </div>
        </div>
      </aside>
    </div>
  );
}

type Backlink = { doc: string; section: string; delay: number };

const BACKLINKS: Backlink[] = [
  { doc: "Customer Comms · Returns", section: "§ Email template R09", delay: 520 },
  { doc: "On-call Runbook · Payments", section: "§ ACH failure escalation", delay: 1560 },
  { doc: "PR description · #1247", section: "Auto-linked from merge", delay: 2600 },
];

function BacklinkRow({ b }: { b: Backlink }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        ...reveal(b.delay, "lpRevealX", 380),
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)" }}>{b.doc}</span>
      <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "var(--font-serif)" }}>
        {b.section}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Animated connector (between source and Aqli node)
// ─────────────────────────────────────────────────────────────────────

function FlowConnector({ reverse }: { reverse?: boolean }) {
  return (
    <div
      style={{
        height: 220,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 220"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <linearGradient id="lpFlowGrad" x1={reverse ? "1" : "0"} x2={reverse ? "0" : "1"} y1="0" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 110 C 70 110, 130 110, 200 110"
          stroke="var(--border-strong)"
          strokeWidth="1.2"
          fill="none"
          strokeDasharray="3 4"
        />
        <path
          d="M0 110 C 70 110, 130 110, 200 110"
          stroke="url(#lpFlowGrad)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="60 200"
          style={{ animation: `${reverse ? "lpDashRev" : "lpDash"} ${STEP_DURATION_MS}ms linear infinite` }}
        />
      </svg>
      {/* Travelling pulse — transform-only so it stays on the compositor */}
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "var(--accent)",
          boxShadow: "0 0 0 4px rgba(15,110,86,0.18)",
          willChange: "transform",
          animation: `${reverse ? "lpPulseRev" : "lpPulse"} ${STEP_DURATION_MS}ms linear infinite`,
        }}
      />
    </div>
  );
}
