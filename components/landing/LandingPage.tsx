"use client";

// Aqli — Landing page (LP1 · Landing — interactive flow)
// Marketing front door: nav, hero, the interactive Aqli Loop demo,
// logo strip, three primitives, how-it-works, quote, CTA, footer.
// Ported from the LP1 design handoff; reads only existing tokens.
//
// Responsive: a single `useIsMobile()` switch (≤767px) restructures
// layout — nav collapses, multi-column grids stack, paddings tighten.
// The big display type uses clamp() so it scales fluidly with no
// hydration flash, even before the structural switch kicks in.

import Link from "next/link";
import type { ReactNode } from "react";

import { AqliMark } from "@/components/aqli/AqliMark";
import {
  IconArrowUpRight,
  IconCheck,
  IconGitHub,
  IconRobot,
} from "@/components/aqli/icons";
import { FlowDemo } from "./FlowDemo";
import { useIsMobile } from "./useIsMobile";

// Fluid horizontal gutter — 20px on phones, up to 56px on desktop.
const GUTTER = "clamp(20px, 5vw, 56px)";

function IconArrowRight({ size = 16, sw = 1.8 }: { size?: number; sw?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Section shell — full-bleed background, centred 1440 content column
// ─────────────────────────────────────────────────────────────────────

function SectionShell({
  children,
  background,
  borderBottom = true,
  borderTop = false,
  as: Tag = "section",
  id,
}: {
  children: ReactNode;
  background?: string;
  borderBottom?: boolean;
  borderTop?: boolean;
  as?: "section" | "footer";
  id?: string;
}) {
  return (
    <Tag
      id={id}
      style={{
        background,
        borderBottom: borderBottom ? "1px solid var(--border)" : undefined,
        borderTop: borderTop ? "1px solid var(--border)" : undefined,
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>{children}</div>
    </Tag>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Nav
// ─────────────────────────────────────────────────────────────────────

const navLinkStyle = { color: "var(--text-secondary)", cursor: "pointer" } as const;

function LandingNav({ isMobile }: { isMobile: boolean }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        borderBottom: "1px solid var(--border)",
        background: "rgba(250,250,248,0.85)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          height: isMobile ? 56 : 64,
          maxWidth: 1440,
          margin: "0 auto",
          padding: `0 ${GUTTER}`,
          display: "flex",
          alignItems: "center",
          gap: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AqliMark size={20} />
          <span style={{ fontSize: 16, letterSpacing: "0.08em", fontWeight: 500, color: "var(--text-primary)" }}>
            aqli
          </span>
        </div>

        {!isMobile && (
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              marginLeft: 24,
              fontSize: 13.5,
              color: "var(--text-secondary)",
            }}
          >
            <a href="#product" style={navLinkStyle}>Product</a>
            <a href="#loop" style={navLinkStyle}>For agents</a>
            <a href="#how-it-works" style={navLinkStyle}>Docs</a>
            <a href="#pricing" style={navLinkStyle}>Pricing</a>
            <a href="#changelog" style={navLinkStyle}>Changelog</a>
          </nav>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {!isMobile && (
            <a
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <IconGitHub size={15} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>3.2k</span>
            </a>
          )}
          <Link
            href="/login"
            style={{ fontSize: 13.5, color: "var(--text-primary)", fontWeight: 500, cursor: "pointer" }}
          >
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary" style={{ height: 34 }}>
            <span>Start free</span>
            <IconArrowRight size={12} sw={2} />
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────

function Hero({ isMobile }: { isMobile: boolean }) {
  return (
    <section
      style={{
        maxWidth: 1440,
        margin: "0 auto",
        padding: `clamp(48px, 9vw, 88px) ${GUTTER} clamp(40px, 7vw, 64px)`,
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 28,
        justifyItems: "center",
        textAlign: "center",
      }}
    >
      {/* Pre-headline pill */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px 6px 6px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 999,
          fontSize: isMobile ? 11.5 : 12,
          color: "var(--text-secondary)",
          maxWidth: "100%",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 20,
            padding: "0 8px",
            borderRadius: 999,
            background: "var(--accent-light)",
            color: "var(--accent)",
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          New
        </span>
        <span>The MCP server is live. Connect any agent in 30 seconds.</span>
        <IconArrowUpRight size={12} sw={1.8} style={{ flexShrink: 0 }} />
      </div>

      {/* Headline */}
      <h1
        style={{
          margin: 0,
          maxWidth: 980,
          fontFamily: "var(--font-serif)",
          fontWeight: 400,
          fontSize: "clamp(36px, 9vw, 88px)",
          lineHeight: isMobile ? 1.08 : 1.02,
          letterSpacing: "-0.025em",
          color: "var(--text-primary)",
          textWrap: "balance",
        }}
      >
        The shared intellect
        <br />
        <span style={{ fontStyle: "italic", color: "var(--accent)" }}>for humans and their agents.</span>
      </h1>

      {/* Sub */}
      <p
        style={{
          margin: 0,
          maxWidth: 620,
          fontSize: "clamp(15px, 4vw, 18px)",
          lineHeight: 1.55,
          color: "var(--text-secondary)",
          textWrap: "pretty",
        }}
      >
        Aqli is the docs layer your team and your AI agents share. Humans write, agents read. Agents draft, humans
        review. One source of truth, audited end-to-end.
      </p>

      {/* CTAs */}
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: 10,
          marginTop: 6,
          alignItems: "center",
          width: isMobile ? "100%" : undefined,
          maxWidth: isMobile ? 360 : undefined,
        }}
      >
        <Link
          href="/signup"
          className="btn btn-primary"
          style={{ height: 44, padding: "0 18px", fontSize: 14.5, width: isMobile ? "100%" : undefined, justifyContent: "center" }}
        >
          <span>Start your workspace</span>
          <IconArrowRight size={13} sw={2} />
        </Link>
        <a
          href="#loop"
          className="btn btn-secondary"
          style={{ height: 44, padding: "0 18px", fontSize: 14.5, width: isMobile ? "100%" : undefined, justifyContent: "center" }}
        >
          <span>See it in 2 minutes</span>
        </a>
      </div>

      {/* Trust line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: isMobile ? "6px 12px" : 14,
          marginTop: 8,
          fontSize: 12.5,
          color: "var(--text-muted)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <IconCheck size={12} sw={2.2} /> Free for teams up to 5
        </span>
        <span>·</span>
        <span>Self-host or cloud</span>
        <span>·</span>
        <span>Open source · MIT</span>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Logo strip
// ─────────────────────────────────────────────────────────────────────

function WordLogo({ name, weight = 500, italic }: { name: string; weight?: number; italic?: boolean }) {
  return (
    <span
      style={{
        fontSize: 19,
        fontWeight: weight,
        fontStyle: italic ? "italic" : "normal",
        letterSpacing: "-0.015em",
        color: "var(--text-secondary)",
        fontFamily: italic ? "var(--font-serif)" : "var(--font-sans)",
      }}
    >
      {name}
    </span>
  );
}

function LogosStrip() {
  return (
    <SectionShell>
      <div style={{ padding: `0 ${GUTTER} clamp(48px, 9vw, 64px)` }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Teams using Aqli to ground their agents
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 56, opacity: 0.7, flexWrap: "wrap", justifyContent: "center" }}>
            <WordLogo name="Mercury" weight={500} />
            <WordLogo name="Linear" italic />
            <WordLogo name="Ramp" weight={600} />
            <WordLogo name="Vercel" />
            <WordLogo name="Replicate" />
            <WordLogo name="Plaid" weight={600} />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Three primitives
// ─────────────────────────────────────────────────────────────────────

function SectionEyebrow({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}
    >
      <span style={{ width: 18, height: 1, background: "var(--text-muted)" }} />
      {label}
    </div>
  );
}

function Primitives({ isMobile }: { isMobile: boolean }) {
  return (
    <SectionShell id="product">
      <div style={{ padding: `clamp(64px, 11vw, 96px) ${GUTTER}` }}>
        <SectionEyebrow label="What it is" />
        <h2
          style={{
            margin: "12px 0 18px",
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: "clamp(34px, 7vw, 52px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            maxWidth: 880,
            textWrap: "balance",
          }}
        >
          Three primitives.
          <br />
          <span style={{ color: "var(--text-secondary)" }}>That&apos;s the whole product.</span>
        </h2>
        <p style={{ margin: "0 0 clamp(36px, 7vw, 56px)", maxWidth: 620, fontSize: 16, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          Most knowledge tools layer a wiki, a chat, and a vector store and hope the seams hold. Aqli works the
          other way around: one doc model designed so humans and agents can write into the same surface without
          stepping on each other.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          <PrimitiveCard
            number="01"
            title="Docs"
            body="A clean, opinionated editor. Markdown shortcuts, slash menu, AI inline rewrites. Every doc carries a status — Draft, In Review, Approved, Stale — and a version history. No more 'is this the latest one?'"
            ornament={<PrimMockDoc />}
          />
          <PrimitiveCard
            number="02"
            title="Agents"
            body="Agents are first-class authors with their own API keys, scopes, and activity logs. They read approved context through one endpoint and write drafts that humans review. Wire up Claude Code, Cursor, GPT, or your own agent in 30 seconds."
            ornament={<PrimMockAgent />}
            accent
          />
          <PrimitiveCard
            number="03"
            title="Reviews"
            body="Every agent doc lands in a review queue with a diff, the context it read, and a one-click Approve / Request changes / Reject. The agent learns from your feedback; the doc only goes live when a human says yes."
            ornament={<PrimMockReview />}
          />
        </div>
      </div>
    </SectionShell>
  );
}

function PrimitiveCard({
  number,
  title,
  body,
  ornament,
  accent,
}: {
  number: string;
  title: string;
  body: string;
  ornament: ReactNode;
  accent?: boolean;
}) {
  return (
    <article
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${accent ? "rgba(15,110,86,0.25)" : "var(--border)"}`,
        borderRadius: 14,
        padding: "26px 26px 0",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "hidden",
        minHeight: 460,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-muted)",
          letterSpacing: "0.06em",
        }}
      >
        {number}
      </span>
      <h3
        style={{
          margin: 0,
          fontFamily: "var(--font-serif)",
          fontWeight: 400,
          fontSize: 32,
          letterSpacing: "-0.015em",
          color: accent ? "var(--accent)" : "var(--text-primary)",
        }}
      >
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>{body}</p>
      <div style={{ flex: 1 }} />
      <div style={{ marginTop: 14, marginBottom: -1 }}>{ornament}</div>
    </article>
  );
}

// ── Ornaments per primitive card ─────────────────────────────────────

function Pill({ bg, color, border, children }: { bg: string; color: string; border: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 18,
        padding: "0 6px",
        background: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </span>
  );
}

function PrimMockDoc() {
  return (
    <div
      style={{
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        padding: "18px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: 160,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Pill bg="var(--approved-bg)" color="var(--approved-text)" border="var(--approved-border)">
          Approved
        </Pill>
        <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>v4</span>
      </div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
        Customer Payout Schedule
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        The standard cadence is daily at 17:00 PT. Wire-funded payouts settle the next business day; ACH-funded
        settle in 3.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 10.5, color: "var(--text-muted)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "linear-gradient(135deg, #2F7D62, #0F6E56)",
              color: "#fff",
              fontSize: 8,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            A
          </span>
          Ali · last reviewed 2 days ago
        </span>
      </div>
    </div>
  );
}

function PrimMockAgent() {
  return (
    <div
      style={{
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        padding: "18px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 160,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--text-primary)",
        lineHeight: 1.6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: "var(--agent-tint)",
            border: "1px solid var(--agent-border)",
            color: "var(--agent-icon)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-sans)",
          }}
        >
          <IconRobot size={11} />
        </span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, fontWeight: 500 }}>Claude Code</span>
      </div>
      <div>
        <span style={{ color: "var(--text-muted)" }}>$ </span>
        <span style={{ color: "var(--accent)" }}>curl</span>{" "}
        <span style={{ color: "var(--text-secondary)" }}>aqli.app/api/context \</span>
      </div>
      <div style={{ paddingLeft: 12, color: "var(--text-secondary)" }}>
        -H <span style={{ color: "var(--review-text)" }}>&quot;Authorization: Bearer aqli_live_8a3f…&quot;</span>
      </div>
      <div style={{ paddingLeft: 12, color: "var(--text-secondary)" }}>
        -G --data-urlencode <span style={{ color: "var(--review-text)" }}>&quot;q=payout retry&quot;</span>
      </div>
      <div
        style={{
          marginTop: 4,
          padding: "6px 8px",
          background: "var(--accent-light)",
          border: "1px solid rgba(15,110,86,0.2)",
          borderRadius: 4,
          color: "var(--accent)",
          fontSize: 10.5,
        }}
      >
        → 4 approved chunks · 142 tokens
      </div>
    </div>
  );
}

const miniBtnStyles = {
  primary: { bg: "var(--accent)", color: "#fff", border: "var(--accent)" },
  warn: { bg: "var(--bg-card)", color: "var(--text-primary)", border: "var(--border)" },
  danger: { bg: "transparent", color: "#993C1D", border: "transparent" },
} as const;

function miniBtn(kind: keyof typeof miniBtnStyles): React.CSSProperties {
  const p = miniBtnStyles[kind];
  return {
    flex: 1,
    height: 24,
    padding: "0 8px",
    background: p.bg,
    color: p.color,
    border: `1px solid ${p.border}`,
    borderRadius: 5,
    fontSize: 10.5,
    fontWeight: 500,
    cursor: "pointer",
  };
}

function PrimMockReview() {
  return (
    <div
      style={{
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 160,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Pill bg="var(--review-bg)" color="var(--review-text)" border="var(--review-border)">
          Review
        </Pill>
        <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>+8 / −2</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>
        Fix: Payout retry on transient bank failures
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          lineHeight: 1.55,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "6px 8px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span style={{ color: "var(--approved-text)" }}>+ Retry on any 5xx that isn&apos;t 501</span>
        <span style={{ color: "#993C1D" }}>− Retry only on 408 timeouts</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button style={miniBtn("danger")}>Reject</button>
        <button style={miniBtn("warn")}>Request changes</button>
        <button style={miniBtn("primary")}>Approve</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// How it works
// ─────────────────────────────────────────────────────────────────────

function HowItWorks({ isMobile }: { isMobile: boolean }) {
  return (
    <SectionShell id="how-it-works" background="var(--bg-sidebar)">
      <div style={{ padding: `clamp(64px, 11vw, 96px) ${GUTTER}` }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "360px 1fr",
            gap: isMobile ? 36 : 56,
            alignItems: "start",
          }}
        >
          <div style={{ position: isMobile ? "static" : "sticky", top: 88 }}>
            <SectionEyebrow label="How it works" />
            <h2
              style={{
                margin: "12px 0 18px",
                fontFamily: "var(--font-serif)",
                fontWeight: 400,
                fontSize: "clamp(30px, 6vw, 44px)",
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                textWrap: "balance",
              }}
            >
              From sign-up to first agent draft in under five minutes.
            </h2>
            <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              No long onboarding. The product is designed so the first valuable thing you do is watch an agent
              write something a human approves.
            </p>
          </div>

          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 20 }}>
            <StepRow
              n="01"
              title="Create the workspace"
              body="Pick a name, invite a teammate or two. Aqli sets up a starter space and a small library of doc templates — PRD, ADR, Runbook, Fix Note, Policy."
            />
            <StepRow
              n="02"
              title="Drop in your existing docs"
              body="Paste them, import from Notion/Confluence, or commit Markdown via the GitHub mirror. Aqli indexes them and marks each one with a status you can change."
            />
            <StepRow
              n="03"
              title="Connect your first agent"
              body="Generate an API key with the scopes you want. Hand it to Claude Code, Cursor, GPT, or any MCP-compatible client. The agent immediately starts reading approved context."
            />
            <StepRow
              n="04"
              title="Review what it writes"
              body="When the agent has something to share, it drafts a doc and you get a notification. Approve, request changes, or reject — the agent learns from your decision."
              last
            />
          </ol>
        </div>
      </div>
    </SectionShell>
  );
}

function StepRow({ n, title, body, last }: { n: string; title: string; body: string; last?: boolean }) {
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "60px 1fr",
        gap: 20,
        paddingBottom: last ? 0 : 20,
        borderBottom: last ? "none" : "1px solid var(--border)",
        alignItems: "start",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 32,
          fontWeight: 400,
          color: "var(--accent)",
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        {n}
      </span>
      <div>
        <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 500, letterSpacing: "-0.005em" }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>{body}</p>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Pull quote
// ─────────────────────────────────────────────────────────────────────

function Quote() {
  return (
    <SectionShell>
      <div style={{ padding: `clamp(72px, 14vw, 120px) ${GUTTER}`, display: "flex", justifyContent: "center" }}>
        <figure
          style={{
            margin: 0,
            maxWidth: 880,
            display: "flex",
            flexDirection: "column",
            gap: 28,
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 56, color: "var(--accent)", lineHeight: 0.6 }}>
            &ldquo;
          </span>
          <blockquote
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: "clamp(24px, 5.5vw, 36px)",
              letterSpacing: "-0.015em",
              lineHeight: 1.2,
              color: "var(--text-primary)",
              textWrap: "balance",
            }}
          >
            We stopped guessing whether our agents were writing the right thing. With Aqli, every draft comes with
            the docs it read and a diff against what we already know.
          </blockquote>
          <figcaption
            style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--text-secondary)" }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: "linear-gradient(135deg, #4A6FB5, #2C4A82)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              MK
            </span>
            <span>
              <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Maya Krishnan</strong> · Head of
              Platform, Mercury
            </span>
          </figcaption>
        </figure>
      </div>
    </SectionShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Final CTA
// ─────────────────────────────────────────────────────────────────────

function FinalCTA({ isMobile }: { isMobile: boolean }) {
  return (
    <SectionShell id="pricing" background="var(--bg-card)">
      <div style={{ padding: `clamp(72px, 14vw, 120px) ${GUTTER}`, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            maxWidth: 720,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 24,
          }}
        >
          <AqliMark size={32} />
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: "clamp(34px, 8vw, 56px)",
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
              textWrap: "balance",
            }}
          >
            Give your agents
            <br />
            <em style={{ color: "var(--accent)" }}>somewhere to think.</em>
          </h2>
          <p style={{ margin: 0, fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 520 }}>
            Free for teams up to 5. Self-host or use Aqli Cloud. No credit card to get started.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: 10,
              marginTop: 6,
              width: isMobile ? "100%" : undefined,
              maxWidth: isMobile ? 360 : undefined,
            }}
          >
            <Link
              href="/signup"
              className="btn btn-primary"
              style={{ height: 46, padding: "0 22px", fontSize: 14.5, width: isMobile ? "100%" : undefined, justifyContent: "center" }}
            >
              <span>Start your workspace</span>
              <span style={{ display: "inline-flex", marginLeft: 2 }}>
                <IconArrowRight size={13} sw={2} />
              </span>
            </Link>
            <a
              href="mailto:hello@aqli.app"
              className="btn btn-secondary"
              style={{ height: 46, padding: "0 22px", fontSize: 14.5, width: isMobile ? "100%" : undefined, justifyContent: "center" }}
            >
              <span>Talk to the team</span>
            </a>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {title}
      </div>
      {items.map((it) => (
        <a key={it} style={{ fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
          {it}
        </a>
      ))}
    </div>
  );
}

function LandingFooter({ isMobile }: { isMobile: boolean }) {
  return (
    <SectionShell as="footer" id="changelog" background="var(--bg-base)" borderBottom={false} borderTop>
      <div style={{ padding: `clamp(40px, 8vw, 56px) ${GUTTER} 36px` }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)",
            gap: isMobile ? "32px 24px" : 28,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              gridColumn: isMobile ? "span 2" : "span 1",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AqliMark size={16} />
              <span style={{ fontSize: 13, letterSpacing: "0.08em", fontWeight: 500 }}>aqli</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55, maxWidth: 220 }}>
              The shared intellect layer for humans and their AI agents.
            </p>
          </div>

          <FooterCol title="Product" items={["Editor", "Agents API", "Reviews", "Integrations", "Changelog"]} />
          <FooterCol title="For agents" items={["MCP server", "REST reference", "Scopes & keys", "Example agents", "Cookbook"]} />
          <FooterCol title="Company" items={["About", "Blog", "Careers", "Press kit", "Contact"]} />
          <FooterCol title="Resources" items={["Docs", "Status", "Security", "Terms", "Privacy"]} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: isMobile ? 12 : 0,
            paddingTop: 24,
            borderTop: "1px solid var(--border)",
            fontSize: 11.5,
            color: "var(--text-muted)",
          }}
        >
          <span>© 2026 Aqli, Inc · Open source under MIT</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? "6px 14px" : 18 }}>
            <span>San Francisco · Dubai</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--approved-text)" }} />
              All systems normal
            </span>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Full page
// ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        background: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <LandingNav isMobile={isMobile} />
      <Hero isMobile={isMobile} />
      <FlowDemo />
      <LogosStrip />
      <Primitives isMobile={isMobile} />
      <HowItWorks isMobile={isMobile} />
      <Quote />
      <FinalCTA isMobile={isMobile} />
      <LandingFooter isMobile={isMobile} />
    </div>
  );
}
