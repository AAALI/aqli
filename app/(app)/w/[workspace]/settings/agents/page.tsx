import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import AppTopBar from "@/components/layout/AppTopBar";
import { StatusBadge } from "@/components/aqli/badges";
import { IconRobot, IconArrowUpRight, IconChevDown } from "@/components/aqli/icons";

type Event = {
  when: string;
  agent: string;
  action: "read" | "wrote" | "requested review";
  target: string;
  space: string;
  detail: string;
  status?: string;
};

const EVENTS: Event[] = [
  { when: "2m", agent: "Claude Code", action: "read", target: "AED Withdrawal Flow", space: "Product", detail: "queried 'withdrawal anomaly threshold' · 4 chunks returned" },
  { when: "8m", agent: "Cursor", action: "read", target: "Reservation Engine Architecture", space: "Engineering", detail: "queried 'sticky routing' · 3 chunks returned" },
  { when: "1h", agent: "Claude Code", action: "wrote", target: "Fix: Payout retry on transient bank failures", space: "Engineering", detail: "new Fix Note · 124 lines · sent for review", status: "Review" },
  { when: "3h", agent: "Claude Code", action: "requested review", target: "Fix: Payout retry on transient bank failures", space: "Engineering", detail: "notified Ali, Sara" },
  { when: "5h", agent: "GPT-4o Batch Worker", action: "read", target: "T&S Hold Rule 4.2", space: "Trust & Safety", detail: "queried 'payout hold thresholds' · 2 chunks returned" },
  { when: "Yesterday", agent: "Cursor", action: "wrote", target: "Sticky-host routing for reservations", space: "Engineering", detail: "new ADR · 86 lines · sent for review", status: "Review" },
  { when: "Yesterday", agent: "Claude Code", action: "wrote", target: "Fix: Identity Verification Status Sync", space: "Engineering", detail: "new Fix Note · 52 lines", status: "Approved" },
];

export default async function SettingsAgentsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "Agent activity" }]} />
      <div className="content" style={{ padding: "32px 44px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, paddingBottom: 22, marginBottom: 22, borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 34, letterSpacing: "-0.015em", lineHeight: 1.1 }}>Agent activity</h1>
              <p style={{ margin: 0, maxWidth: 640, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                Every read and write your agents made, with the context they queried. Use this to build trust before approving the next agent doc.
              </p>
            </div>
            <button className="btn btn-secondary"><span>Export · 7 days</span><IconArrowUpRight size={12} sw={1.7} /></button>
          </header>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
            <AgentSummary name="Claude Code" instance="Ali's laptop" reads={142} writes={8} approval={94} top />
            <AgentSummary name="Cursor" instance="Sara's workstation" reads={86} writes={3} approval={100} />
            <AgentSummary name="GPT-4o Batch Worker" instance="Compliance only" reads={28} writes={0} approval={null} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="fpills">
              <button className="fpill is-active">All · 248</button>
              <button className="fpill">Reads · 224</button>
              <button className="fpill">Writes · 14</button>
              <button className="fpill">Review actions · 10</button>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Agent: <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>All</strong><IconChevDown size={12} />
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Last <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>7 days</strong><IconChevDown size={12} />
              </span>
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "80px 200px 100px 1fr 120px", gap: 14, padding: "12px 20px", background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              <span>When</span><span>Agent</span><span>Action</span><span>Target + context</span><span style={{ justifySelf: "end" }}>Outcome</span>
            </div>
            {EVENTS.map((e, i) => <EventRow key={i} e={e} />)}
          </div>
        </div>
      </div>
    </>
  );
}

function AgentSummary({ name, instance, reads, writes, approval, top }: { name: string; instance: string; reads: number; writes: number; approval: number | null; top?: boolean }) {
  return (
    <div style={{ padding: "16px 18px", background: top ? "var(--accent-light)" : "var(--bg-card)", border: `1px solid ${top ? "rgba(15,110,86,0.25)" : "var(--border)"}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--agent-border)", color: "var(--agent-icon)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconRobot size={17} /></span>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>{name}</span>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{instance}</span>
        </div>
        {top && <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 3, background: "var(--accent)", color: "#fff" }}>Top</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
        <MiniStat value={String(reads)} label="Reads · 7d" />
        <MiniStat value={String(writes)} label="Writes" />
        <MiniStat value={approval == null ? "—" : `${approval}%`} label="Approval rate" last />
      </div>
    </div>
  );
}

function MiniStat({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return (
    <div style={{ paddingRight: last ? 0 : 8, borderRight: last ? "none" : "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
      <span style={{ fontSize: 10.5, color: "var(--text-muted)", letterSpacing: "0.04em" }}>{label}</span>
    </div>
  );
}

function EventRow({ e }: { e: Event }) {
  const palette: Record<string, { bg: string; color: string; border: string }> = {
    read: { bg: "var(--bg-sidebar)", color: "var(--text-secondary)", border: "var(--border)" },
    wrote: { bg: "var(--accent-light)", color: "var(--accent)", border: "rgba(15,110,86,0.25)" },
    "requested review": { bg: "var(--review-bg)", color: "var(--review-text)", border: "var(--review-border)" },
  };
  const p = palette[e.action] ?? palette.read;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "80px 200px 100px 1fr 120px", gap: 14, alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{e.when}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 5, background: "var(--agent-tint)", border: "1px solid var(--agent-border)", color: "var(--agent-icon)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IconRobot size={12} /></span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{e.agent}</span>
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: 6, background: p.bg, color: p.color, border: `1px solid ${p.border}`, fontSize: 11.5, fontWeight: 500, width: "fit-content" }}>{e.action}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.target}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{e.space} · {e.detail}</span>
      </div>
      <span style={{ justifySelf: "end" }}>{e.status ? <StatusBadge status={e.status} /> : <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>—</span>}</span>
    </div>
  );
}
