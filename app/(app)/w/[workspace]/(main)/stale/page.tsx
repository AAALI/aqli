import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import AppTopBar from "@/components/layout/AppTopBar";
import { TypeBadge } from "@/components/aqli/badges";
import { StatCell } from "@/components/settings/primitives";
import { IconChevDown, IconCheck, IconUsers, IconBell, IconArchive, IconRobot, IconSparkle, IconDots, IconX } from "@/components/aqli/icons";

type StaleDoc = {
  title: string;
  type: string;
  space: string;
  owner: { name: string; initial: string; cls: string };
  age: number;
  last: string;
  risk: "high" | "med" | "low";
  reason: string;
};

const STALE_DOCS: StaleDoc[] = [
  { title: "Search Ranking Service Runbook", type: "Runbook", space: "Engineering", owner: { name: "Sara", initial: "S", cls: "avatar-sara" }, age: 142, last: "Jan 15, 2026", risk: "high", reason: "Referenced 38× by agents in the last 30 days" },
  { title: "Reservation Cancellation Policy v2", type: "Policy", space: "Trust & Safety", owner: { name: "Ali", initial: "A", cls: "avatar-ali" }, age: 121, last: "Feb 5, 2026", risk: "high", reason: "Compliance doc — quarterly review required" },
  { title: "Internal Tools — Backfill Playbook", type: "Runbook", space: "Engineering", owner: { name: "Khalid", initial: "K", cls: "avatar-khalid" }, age: 108, last: "Feb 18, 2026", risk: "med", reason: "Linked from 4 active fix notes" },
  { title: "Onboarding Email Sequence v1", type: "PRD", space: "Product", owner: { name: "Ali", initial: "A", cls: "avatar-ali" }, age: 97, last: "Mar 1, 2026", risk: "med", reason: "Superseded by v2 draft (Khalid)" },
  { title: "Webhook Signature Verification", type: "ADR", space: "Engineering", owner: { name: "Sara", initial: "S", cls: "avatar-sara" }, age: 95, last: "Mar 3, 2026", risk: "low", reason: "Not referenced in 30 days" },
  { title: "Bank Settlement Cutoff Windows", type: "Runbook", space: "Engineering", owner: { name: "Khalid", initial: "K", cls: "avatar-khalid" }, age: 92, last: "Mar 6, 2026", risk: "low", reason: "Not referenced in 30 days" },
];

export default async function StalePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Stale docs" }]} />
      <div className="content" style={{ padding: "32px 40px" }}>
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, paddingBottom: 24, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>Hygiene</div>
            <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 34, letterSpacing: "-0.015em", lineHeight: 1.1 }}>Stale docs</h1>
            <p style={{ margin: 0, maxWidth: 640, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              Docs not reviewed within your workspace&apos;s freshness window (90 days). Stale docs still serve agents, but a human should confirm they&apos;re current before they&apos;re treated as ground truth.
            </p>
          </div>
          <button className="btn btn-secondary"><IconX size={13} /><span>Configure threshold</span></button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 22, overflow: "hidden" }}>
          <StatCell label="Stale docs" value="14" hint="of 38 total · 37%" />
          <StatCell label="High risk" value="2" hint="compliance + agent-referenced" color="#993C1D" />
          <StatCell label="Avg staleness" value="104 days" hint="median 97" />
          <StatCell label="Oldest" value="142 days" hint="Search Ranking Runbook" last />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="fpills">
            <button className="fpill is-active">All · 14</button>
            <button className="fpill"><span style={{ width: 6, height: 6, borderRadius: 999, background: "#993C1D", marginRight: 6, display: "inline-block" }} />High risk · 2</button>
            <button className="fpill"><span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--review-text)", marginRight: 6, display: "inline-block" }} />Medium · 4</button>
            <button className="fpill"><span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--text-muted)", marginRight: 6, display: "inline-block" }} />Low · 8</button>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--text-muted)" }}>Sort:</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Oldest first</span>
            <IconChevDown size={13} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", background: "var(--accent-light)", border: "1px solid rgba(15,110,86,0.25)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          <span style={{ width: 18, height: 18, borderRadius: 4, background: "var(--accent)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IconCheck size={11} sw={2.4} /></span>
          <span style={{ color: "var(--accent)", fontWeight: 500 }}>2 selected</span>
          <span style={{ color: "var(--text-secondary)" }}>·</span>
          <span style={{ color: "var(--text-secondary)" }}>Search Ranking Runbook, Reservation Cancellation Policy v2</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary"><IconUsers size={13} /><span>Reassign owner</span></button>
          <button className="btn btn-secondary"><IconBell size={13} /><span>Request re-review</span></button>
          <button className="btn btn-ghost btn-ghost-danger"><IconArchive size={13} /><span>Archive</span></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STALE_DOCS.map((d, i) => <StaleRow key={i} d={d} selected={i < 2} />)}
        </div>

        <div style={{ marginTop: 22, padding: "16px 18px", background: "var(--bg-sidebar)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 28, height: 28, borderRadius: 6, background: "var(--accent-light)", color: "var(--accent)", border: "1px solid rgba(15,110,86,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconSparkle size={13} /></span>
          <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Aqli suggests:</strong> ask Claude Code to draft a refresh of the two high-risk docs. Each draft will land in Draft for your review.
          </div>
          <button className="btn btn-secondary"><IconRobot size={13} /><span>Ask agent to refresh</span></button>
        </div>
      </div>
    </>
  );
}

function StaleRow({ d, selected }: { d: StaleDoc; selected?: boolean }) {
  const palette = {
    high: { bg: "var(--stale-bg)", color: "var(--stale-text)", border: "var(--stale-border)", label: "High" },
    med: { bg: "var(--review-bg)", color: "var(--review-text)", border: "var(--review-border)", label: "Medium" },
    low: { bg: "var(--draft-bg)", color: "var(--draft-text)", border: "var(--draft-border)", label: "Low" },
  }[d.risk];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "22px 70px 1fr 100px 150px 110px 32px", gap: 14, alignItems: "center", padding: "14px 18px", background: "var(--bg-card)", border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, boxShadow: selected ? "0 0 0 2px rgba(15,110,86,0.08)" : "none" }}>
      <span style={{ width: 18, height: 18, borderRadius: 4, background: selected ? "var(--accent)" : "var(--bg-base)", border: `1.5px solid ${selected ? "var(--accent)" : "var(--border-strong)"}`, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{selected && <IconCheck size={11} sw={2.4} />}</span>
      <TypeBadge type={d.type} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>{d.title}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.space} · {d.reason}</span>
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "0 8px", borderRadius: 6, background: palette.bg, color: palette.color, border: `1px solid ${palette.border}`, fontSize: 11.5, fontWeight: 500, width: "fit-content" }}>
        <span style={{ width: 5, height: 5, borderRadius: 999, background: "currentColor" }} />{palette.label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
        <span className={`avatar avatar-sm ${d.owner.cls}`}>{d.owner.initial}</span>
        <span>{d.owner.name}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: d.risk === "high" ? "#993C1D" : "var(--text-secondary)", fontWeight: 500 }}>{d.age} days</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>since {d.last}</span>
      </div>
      <span style={{ color: "var(--text-muted)", justifySelf: "center", cursor: "pointer" }}><IconDots size={16} /></span>
    </div>
  );
}
