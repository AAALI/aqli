import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import AppTopBar from "@/components/layout/AppTopBar";
import { SettingsCard, Toggle } from "@/components/settings/primitives";
import { SlackLogo } from "@/components/settings/BrandLogos";
import { IconBell, IconMail } from "@/components/aqli/icons";

type Ch = "on" | "off" | "na";

const MATRIX: { label: string; desc: string; channels: [Ch, Ch, Ch] }[] = [
  { label: "Review requested on a doc I own", desc: "Someone (or an agent) wants you to review.", channels: ["on", "on", "on"] },
  { label: "@Mention in a doc or comment", desc: "You were pinged directly.", channels: ["on", "on", "on"] },
  { label: "My doc was approved / changes requested", desc: "Final decision on a doc you authored.", channels: ["on", "on", "off"] },
  { label: "Agent submitted a doc in my space", desc: "An agent posted a Draft in a space you watch.", channels: ["on", "off", "off"] },
  { label: "A doc I own went stale", desc: "Crossed your workspace freshness threshold (90 days).", channels: ["on", "on", "off"] },
  { label: "Weekly digest", desc: "Monday morning summary of last week's docs + reviews.", channels: ["off", "on", "off"] },
  { label: "Comment replies on threads I'm in", desc: "Someone replied to a thread you commented in.", channels: ["on", "off", "na"] },
];

export default async function SettingsNotificationsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "Notifications" }]} />
      <div className="content" style={{ padding: "32px 44px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, paddingBottom: 22, marginBottom: 22, borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 34, letterSpacing: "-0.015em", lineHeight: 1.1 }}>Notifications</h1>
              <p style={{ margin: 0, maxWidth: 640, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                How Aqli reaches you when something changes. These are your personal preferences — workspace admins set the defaults, you can override per channel.
              </p>
            </div>
            <button className="btn btn-secondary">Reset to defaults</button>
          </header>

          <SettingsCard title="Quiet hours" sub="Aqli holds non-urgent notifications until you're back. Urgent (review requests on docs you own) still come through.">
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "var(--accent-light)", border: "1px solid rgba(15,110,86,0.25)", borderRadius: 8 }}>
              <span style={{ width: 32, height: 18, borderRadius: 999, background: "var(--accent)", position: "relative", display: "inline-block" }}>
                <span style={{ position: "absolute", top: 2, left: 16, width: 14, height: 14, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
              </span>
              <span style={{ fontSize: 13.5, color: "var(--text-primary)", fontWeight: 500 }}>Quiet from</span>
              <Pill>19:00</Pill>
              <span style={{ fontSize: 13.5, color: "var(--text-primary)" }}>to</span>
              <Pill>08:00</Pill>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", marginLeft: 4 }}>· Asia/Dubai</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Mon–Fri only</span>
            </div>
          </SettingsCard>

          <SettingsCard title="What to notify me about" sub="Pick the channels for each event. In-app is always available; turn off to silence the bell.">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 88px 88px 88px", gap: 14, paddingBottom: 8, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              <span>Event</span>
              <span style={{ justifySelf: "center", display: "inline-flex", alignItems: "center", gap: 4 }}><IconBell size={11} /> In-app</span>
              <span style={{ justifySelf: "center", display: "inline-flex", alignItems: "center", gap: 4 }}><IconMail size={11} /> Email</span>
              <span style={{ justifySelf: "center", display: "inline-flex", alignItems: "center", gap: 4 }}><SlackLogo size={14} /> Slack</span>
            </div>
            {MATRIX.map((row) => (
              <div key={row.label} style={{ display: "grid", gridTemplateColumns: "1fr 88px 88px 88px", gap: 14, alignItems: "center", padding: "14px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{row.label}</span>
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>{row.desc}</span>
                </div>
                {row.channels.map((c, i) => <ChannelDot key={i} state={c} />)}
              </div>
            ))}
          </SettingsCard>

          <SettingsCard title="Other channels">
            <Toggle label="Browser push notifications" desc="Real-time alerts even when Aqli isn't focused. Requires permission." />
            <Toggle label="Daily digest email" desc="If your inbox is busy, batch into one 18:00 GST summary instead of per-event." />
            <Toggle label="Email me a copy of every Slack notification" desc="Useful if you don't always read Slack DMs." />
          </SettingsCard>
        </div>
      </div>
    </>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span style={{ padding: "4px 10px", borderRadius: 6, background: "var(--bg-card)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-primary)" }}>{children}</span>;
}

function ChannelDot({ state }: { state: Ch }) {
  if (state === "na") {
    return <span style={{ justifySelf: "center", width: 28, height: 28, borderRadius: 6, background: "var(--bg-sidebar)", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", fontSize: 11 }}>—</span>;
  }
  const on = state === "on";
  return (
    <span style={{ justifySelf: "center", width: 32, height: 18, borderRadius: 999, background: on ? "var(--accent)" : "var(--border-strong)", position: "relative", display: "inline-block" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
    </span>
  );
}
