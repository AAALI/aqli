"use client";

import { useState } from "react";
import { IconPlus, IconDots, IconChevDown, IconX, IconMail } from "@/components/aqli/icons";
import { SettingsHeader } from "@/components/settings/primitives";
import { MEMBERS, type Member } from "@/lib/mock/settings";

export default function MembersClient() {
  const [open, setOpen] = useState(false);

  return (
    <div className="content" style={{ padding: "32px 44px", position: "relative", overflow: open ? "hidden" : "auto" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", opacity: open ? 0.4 : 1 }}>
        <SettingsHeader
          title="Members"
          sub="Anyone with an ACME account can read, write, and review docs. Admins can manage workspace settings, members, and API keys."
          action={
            <button className="btn btn-primary" onClick={() => setOpen(true)}>
              <IconPlus size={14} sw={2} />
              <span>Invite member</span>
            </button>
          }
        />

        <div className="fpills" style={{ marginBottom: 18 }}>
          <button className="fpill is-active">All · 4</button>
          <button className="fpill">Admins · 2</button>
          <button className="fpill">Editors · 2</button>
          <button className="fpill">Viewers · 0</button>
          <button className="fpill">Pending · 1</button>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 240px 120px 200px 32px", gap: 16, padding: "12px 20px", background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            <span>Member</span>
            <span>Email</span>
            <span>Role</span>
            <span>Last active</span>
            <span />
          </div>
          {MEMBERS.map((m, i) => <MemberRow key={i} m={m} />)}
        </div>
      </div>

      {open && (
        <>
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,20,18,0.32)", zIndex: 50 }} onClick={() => setOpen(false)} />
          <InviteModal onClose={() => setOpen(false)} />
        </>
      )}
    </div>
  );
}

function MemberRow({ m }: { m: Member }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 240px 120px 200px 32px", gap: 16, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className={`avatar ${m.cls}`} style={{ width: 32, height: 32, fontSize: 12 }}>{m.initial}</span>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>{m.name}</div>
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-secondary)" }}>{m.email}</span>
      <div><RoleChip role={m.role} /></div>
      <div style={{ fontSize: 12.5, color: m.status === "pending" ? "var(--review-text)" : "var(--text-secondary)" }}>
        {m.status === "pending" && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginRight: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--review-text)" }} />
            Pending ·
          </span>
        )}
        {m.joined}
      </div>
      <span style={{ color: "var(--text-muted)", justifySelf: "center", cursor: "pointer" }}><IconDots size={16} /></span>
    </div>
  );
}

function RoleChip({ role }: { role: string }) {
  const palette: Record<string, { bg: string; color: string; border: string }> = {
    Admin: { bg: "var(--accent-light)", color: "var(--accent)", border: "rgba(15,110,86,0.25)" },
    Editor: { bg: "var(--bg-sidebar)", color: "var(--text-secondary)", border: "var(--border)" },
    Viewer: { bg: "var(--draft-bg)", color: "var(--draft-text)", border: "var(--draft-border)" },
  };
  const p = palette[role] ?? palette.Editor;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "0 8px", borderRadius: 6, background: p.bg, color: p.color, border: `1px solid ${p.border}`, fontSize: 11.5, fontWeight: 500 }}>
      {role}
      <IconChevDown size={11} />
    </span>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{hint}</span>}
    </label>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 520, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 18px 48px -12px rgba(20,20,18,0.32), 0 2px 6px rgba(20,20,18,0.06)", padding: "24px 26px", zIndex: 51, display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em" }}>Invite to ACME</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>They&apos;ll get an email with a link to set a password and join.</p>
      </div>
      <Field label="Email addresses" hint="Paste multiple emails separated by commas or spaces.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 10px", background: "var(--bg-base)", border: "1px solid var(--accent)", boxShadow: "0 0 0 3px rgba(15,110,86,0.12)", borderRadius: 8, minHeight: 40 }}>
          {["leyla@acme.com", "hassan@acme.com"].map((e) => (
            <span key={e} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)" }}>
              {e}
              <span style={{ color: "var(--text-muted)", marginLeft: 2, cursor: "pointer", display: "flex" }}><IconX size={10} sw={1.8} /></span>
            </span>
          ))}
          <span style={{ fontSize: 13, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", padding: "0 4px" }}>+</span>
        </div>
      </Field>
      <Field label="Role">
        <RoleSelect />
      </Field>
      <Field label="Note (optional)">
        <textarea defaultValue="Hey — joining you to our Aqli workspace. Start with the Engineering space." style={{ minHeight: 70, padding: "10px 12px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.55, resize: "vertical", fontFamily: "inherit" }} />
      </Field>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>2 invites · expire in 7 days</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onClose}>
            <IconMail size={13} /><span>Send invites</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleSelect() {
  const opts = [
    { id: "admin", label: "Admin", desc: "Full access — settings, members, API keys." },
    { id: "editor", label: "Editor", desc: "Read, write, review every doc.", on: true },
    { id: "viewer", label: "Viewer", desc: "Read-only across the workspace." },
  ];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {opts.map((o) => (
        <div key={o.id} style={{ flex: 1, padding: "10px 12px", background: o.on ? "var(--accent-light)" : "var(--bg-base)", border: `1px solid ${o.on ? "rgba(15,110,86,0.3)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: 999, border: `1.5px solid ${o.on ? "var(--accent)" : "var(--border-strong)"}`, background: o.on ? "var(--accent)" : "transparent", position: "relative" }}>
              {o.on && <span style={{ position: "absolute", top: 2.5, left: 2.5, width: 6, height: 6, borderRadius: 999, background: "#fff" }} />}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: o.on ? "var(--accent)" : "var(--text-primary)" }}>{o.label}</span>
          </div>
          <span style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>{o.desc}</span>
        </div>
      ))}
    </div>
  );
}
