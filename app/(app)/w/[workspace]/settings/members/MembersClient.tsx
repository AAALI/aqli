"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconMail, IconTrash, IconLink, IconCheck, IconClock } from "@/components/aqli/icons";
import { SettingsHeader } from "@/components/settings/primitives";
import { avatarColor } from "@/lib/utils";
import type { Role, WorkspaceMember } from "@/types/invitation";

type InviteRow = {
  id: string;
  email: string;
  role: Role;
  token: string;
  created_at: string;
  expires_at: string;
};

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", editor: "Editor", viewer: "Viewer" };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function initialOf(email: string): string {
  return (email.trim()[0] ?? "?").toUpperCase();
}

export default function MembersClient({
  workspaceId,
  workspaceName,
  appUrl,
  canManage,
  currentUserId,
  initialMembers,
  initialInvitations,
}: {
  workspaceId: string;
  workspaceName: string;
  appUrl: string;
  canManage: boolean;
  currentUserId: string | null;
  initialMembers: WorkspaceMember[];
  initialInvitations: InviteRow[];
}) {
  const router = useRouter();
  const [members] = useState<WorkspaceMember[]>(initialMembers);
  const [invites, setInvites] = useState<InviteRow[]>(initialInvitations);
  const [open, setOpen] = useState(false);

  const origin = appUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const inviteLink = (token: string) => `${origin}/invite?token=${token}`;

  const counts = useMemo(() => {
    const c = { all: members.length, admin: 0, editor: 0, viewer: 0 };
    for (const m of members) c[m.role]++;
    return c;
  }, [members]);

  function onCreated(inv: InviteRow) {
    setInvites((prev) => [inv, ...prev]);
  }

  async function revokeInvite(id: string) {
    if (!window.confirm("Revoke this invitation? The link will stop working immediately.")) return;
    const res = await fetch(`/api/invitations/${id}`, { method: "DELETE" });
    if (res.ok) setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="content" style={{ padding: "32px 44px", position: "relative", overflow: open ? "hidden" : "auto" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", opacity: open ? 0.4 : 1 }}>
        <SettingsHeader
          title="Members"
          sub={`Everyone in ${workspaceName} can read, write, and review docs. Admins also manage members, settings, and API keys.`}
          action={
            canManage ? (
              <button className="btn btn-primary" onClick={() => setOpen(true)}>
                <IconPlus size={14} sw={2} />
                <span>Invite member</span>
              </button>
            ) : null
          }
        />

        <div className="fpills" style={{ marginBottom: 18 }}>
          <button className="fpill is-active">All · {counts.all}</button>
          <button className="fpill">Admins · {counts.admin}</button>
          <button className="fpill">Editors · {counts.editor}</button>
          <button className="fpill">Viewers · {counts.viewer}</button>
          {canManage && <button className="fpill">Pending · {invites.length}</button>}
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 200px", gap: 16, padding: "12px 20px", background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            <span>Member</span>
            <span>Role</span>
            <span>Joined</span>
          </div>
          {members.map((m) => (
            <MemberRow key={m.user_id} m={m} isYou={m.user_id === currentUserId} />
          ))}
        </div>

        {canManage && invites.length > 0 && (
          <>
            <div style={{ margin: "28px 0 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Pending invitations
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              {invites.map((inv) => (
                <InviteRowView
                  key={inv.id}
                  inv={inv}
                  link={inviteLink(inv.token)}
                  onRevoke={() => revokeInvite(inv.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {open && (
        <>
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,20,18,0.32)", zIndex: 50 }} onClick={() => setOpen(false)} />
          <InviteModal
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            inviteLink={inviteLink}
            onClose={() => setOpen(false)}
            onCreated={onCreated}
            afterClose={() => router.refresh()}
          />
        </>
      )}
    </div>
  );
}

function MemberRow({ m, isYou }: { m: WorkspaceMember; isYou: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 200px", gap: 16, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{ width: 32, height: 32, borderRadius: 999, background: avatarColor(m.email), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flex: "0 0 32px" }}>{initialOf(m.email)}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {m.email}
          {isYou && <span style={{ marginLeft: 8, fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--text-muted)" }}>You</span>}
        </span>
      </div>
      <div><RoleChip role={m.role} /></div>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{fmtDate(m.created_at)}</div>
    </div>
  );
}

function InviteRowView({ inv, link, onRevoke }: { inv: InviteRow; link: string; onRevoke: () => void }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 96px", gap: 16, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{ width: 32, height: 32, borderRadius: 999, background: "var(--review-bg)", color: "var(--review-text)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 32px" }}><IconClock size={15} /></span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</span>
      </div>
      <div><RoleChip role={inv.role} /></div>
      <button className="btn btn-ghost" onClick={copy} style={{ justifySelf: "start" }}>
        {copied ? <IconCheck size={13} sw={2.2} /> : <IconLink size={13} />}
        <span>{copied ? "Copied" : "Copy link"}</span>
      </button>
      <button className="btn btn-ghost btn-ghost-danger" style={{ justifySelf: "end" }} onClick={onRevoke}>
        <IconTrash size={13} />
        <span>Revoke</span>
      </button>
    </div>
  );
}

function RoleChip({ role }: { role: Role }) {
  const palette: Record<Role, { bg: string; color: string; border: string }> = {
    admin: { bg: "var(--accent-light)", color: "var(--accent)", border: "rgba(15,110,86,0.25)" },
    editor: { bg: "var(--bg-sidebar)", color: "var(--text-secondary)", border: "var(--border)" },
    viewer: { bg: "var(--draft-bg)", color: "var(--draft-text)", border: "var(--draft-border)" },
  };
  const p = palette[role];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: 6, background: p.bg, color: p.color, border: `1px solid ${p.border}`, fontSize: 11.5, fontWeight: 500 }}>
      {ROLE_LABEL[role]}
    </span>
  );
}

const MODAL_SHELL: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "0 18px 48px -12px rgba(20,20,18,0.32), 0 2px 6px rgba(20,20,18,0.06)",
  padding: "24px 26px",
  zIndex: 51,
  maxHeight: "calc(100% - 64px)",
  display: "flex",
  flexDirection: "column",
  gap: 18,
  overflow: "auto",
};

function InviteModal({
  workspaceId,
  workspaceName,
  inviteLink,
  onClose,
  onCreated,
  afterClose,
}: {
  workspaceId: string;
  workspaceName: string;
  inviteLink: (token: string) => string;
  onClose: () => void;
  onCreated: (inv: InviteRow) => void;
  afterClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function send() {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create invitation");
      const inv = data.invitation as InviteRow;
      onCreated(inv);
      setLink(inviteLink(inv.token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (!link) return;
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function close() {
    onClose();
    afterClose();
  }

  return (
    <div style={{ ...MODAL_SHELL, width: 520 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>Invite to {workspaceName}</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {link
            ? "Share this link with the person you invited. It expires in 7 days."
            : "Generate an invite link, then send it to your teammate. The link is the secret — anyone with it can join."}
        </p>
      </div>

      {!link ? (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>Email address</span>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="teammate@company.com"
              style={{ height: 40, padding: "0 12px", background: "var(--bg-base)", border: "1px solid var(--accent)", boxShadow: "0 0 0 3px rgba(15,110,86,0.12)", borderRadius: 8, fontSize: 13.5, color: "var(--text-primary)", fontFamily: "inherit", outline: "none" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>Role</span>
            <div style={{ display: "flex", gap: 8 }}>
              {(["admin", "editor", "viewer"] as Role[]).map((r) => {
                const on = role === r;
                const desc = r === "admin" ? "Settings, members, keys." : r === "editor" ? "Read, write, review." : "Read-only.";
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{ flex: 1, padding: "10px 12px", background: on ? "var(--accent-light)" : "var(--bg-base)", border: `1px solid ${on ? "rgba(15,110,86,0.3)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, textAlign: "left", fontFamily: "inherit" }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: on ? "var(--accent)" : "var(--text-primary)" }}>{ROLE_LABEL[r]}</span>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.35 }}>{desc}</span>
                  </button>
                );
              })}
            </div>
          </label>
          {error && <p style={{ margin: 0, fontSize: 13, color: "#993C1D" }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <button className="btn btn-ghost" onClick={close}>Cancel</button>
            <button className="btn btn-primary" onClick={send} disabled={busy || !email.trim()}>
              <IconMail size={13} /><span>{busy ? "Creating…" : "Create invite link"}</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-primary)", wordBreak: "break-all" }}>
              {link}
            </div>
            <button className="btn btn-secondary" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Aqli doesn&apos;t send the email for you yet — paste this link into your own email or chat. The invitee sets a password and joins as <strong style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{ROLE_LABEL[role]}</strong>.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <button className="btn btn-primary" onClick={close}>
              <IconCheck size={13} sw={2.2} /><span>Done</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
