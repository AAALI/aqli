"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconX } from "@/components/aqli/icons";
import { avatarColor, formatRelative } from "@/lib/utils";
import type { Role, WorkspaceMember } from "@/types/invitation";

type InviteRow = {
  id: string;
  email: string;
  role: Role;
  token: string;
  created_at: string;
  expires_at: string;
  /** Days until it lapses — decided on the server, where the clock is. */
  expiresInDays: number;
};

type MemberView = WorkspaceMember & { owns: number };

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", editor: "Member", viewer: "Reader" };
const COUNT = ["No one", "One person", "Two people", "Three people", "Four people", "Five people", "Six people", "Seven people", "Eight people", "Nine people", "Ten people"];

/**
 * Settings · People (v3 §5.17, frame 17). Members and pending invites in one
 * list, because to a human they are the same thing: people in the workspace,
 * some of whom have not arrived yet. Inviting is a row at the top, not a
 * separate screen.
 */
export default function MembersClient({
  workspaceId,
  appUrl,
  canManage,
  currentUserId,
  initialMembers,
  initialInvitations,
}: {
  workspaceId: string;
  appUrl: string;
  canManage: boolean;
  currentUserId: string | null;
  initialMembers: MemberView[];
  initialInvitations: InviteRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  const origin = appUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const linkFor = (token: string) => `${origin}/invite?token=${token}`;
  const members = initialMembers;
  const invites = initialInvitations;
  const people = members.length;
  const sub = `${COUNT[people] ?? `${people} people`}${invites.length ? `, ${invites.length === 1 ? "one" : invites.length} pending` : ""}. Anyone can write; admins can confirm docs, change settings and invite.`;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, email: email.trim(), role: "editor" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't invite them.");
      await navigator.clipboard?.writeText(linkFor(data.invitation.token)).catch(() => {});
      setNotice({ tone: "ok", text: `Invited ${email.trim()}. Their link is on your clipboard.` });
      setEmail("");
      router.refresh();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Couldn't invite them." });
    } finally {
      setSending(false);
    }
  }

  async function act(key: string, run: () => Promise<Response>) {
    setBusyId(key);
    setMenu(null);
    try {
      const res = await run();
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setNotice({ tone: "error", text: b?.error ?? "That didn't go through." });
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="wrap">
      <div style={{ maxWidth: 700 }}>
        <h1 className="h1">People</h1>
        <p className="h1s">{sub}</p>

        {canManage && (
          <form onSubmit={invite} style={{ marginTop: 22, display: "flex", gap: 9 }}>
            <input
              className="inp"
              type="email"
              style={{ flex: 1 }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com — invite by email"
              aria-label="Email to invite"
            />
            <button type="submit" className="btn btn-primary" style={{ height: 38 }} disabled={sending || !email.trim()}>
              {sending ? "Sending…" : "Send invite"}
            </button>
          </form>
        )}
        {notice && (
          <p role={notice.tone === "error" ? "alert" : "status"} style={{ margin: "10px 0 0", fontSize: 12.5, color: notice.tone === "error" ? "var(--ageing-text)" : "var(--text-secondary)" }}>
            {notice.text}
          </p>
        )}

        <section className="sect">
          <div className="sect-h"><h2>In the workspace</h2></div>
          {members.map((m) => {
            const you = m.user_id === currentUserId;
            const name = m.full_name?.trim() || m.email.split("@")[0];
            const editable = canManage && !you;
            return (
              <div key={m.user_id} className="keyrow" style={{ gridTemplateColumns: "auto 1fr auto auto", gap: 13, opacity: busyId === m.user_id ? 0.55 : 1 }}>
                <span className="avatar" aria-hidden style={{ width: 26, height: 26, flexBasis: 26, fontSize: 10.5, background: avatarColor(name) }}>
                  {name.charAt(0).toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 14, fontWeight: 600 }}>{name}</b>
                  {you && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}> · you</span>}
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
                    {m.email}
                    {m.owns > 0 && ` · owns ${m.owns} doc${m.owns === 1 ? "" : "s"}`}
                  </p>
                </div>
                <span className={`tl ${m.role === "admin" ? "tl-current" : "tl-unverified"}`}>
                  <i aria-hidden />
                  {ROLE_LABEL[m.role]}
                </span>
                <span style={{ position: "relative" }}>
                  {editable ? (
                    <button type="button" className="iconbtn" aria-label={`Change ${name}`} aria-expanded={menu === m.user_id} onClick={() => setMenu(menu === m.user_id ? null : m.user_id)}>
                      ⋯
                    </button>
                  ) : (
                    <span style={{ display: "inline-block", width: 32 }} />
                  )}
                  {menu === m.user_id && (
                    <div className="menu" role="menu">
                      {(Object.keys(ROLE_LABEL) as Role[])
                        .filter((r) => r !== m.role)
                        .map((r) => (
                          <button
                            type="button"
                            role="menuitem"
                            key={r}
                            onClick={() =>
                              act(m.user_id, () =>
                                fetch(`/api/members/${m.user_id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ workspace_id: workspaceId, role: r }),
                                }),
                              )
                            }
                          >
                            Make {ROLE_LABEL[r].toLowerCase()}
                          </button>
                        ))}
                      <button
                        type="button"
                        role="menuitem"
                        style={{ color: "var(--danger-text)" }}
                        onClick={() =>
                          act(m.user_id, () =>
                            fetch(`/api/members/${m.user_id}?workspace_id=${workspaceId}`, { method: "DELETE" }),
                          )
                        }
                      >
                        Remove from workspace
                      </button>
                    </div>
                  )}
                </span>
              </div>
            );
          })}

          {invites.map((inv) => (
            <div key={inv.id} className="keyrow" style={{ gridTemplateColumns: "auto 1fr auto auto", gap: 13, opacity: busyId === inv.id ? 0.55 : 1 }}>
              <span className="avatar" aria-hidden style={{ width: 26, height: 26, flexBasis: 26, fontSize: 10.5, background: "var(--unver-bg)", color: "var(--text-muted)", border: "1px dashed var(--border-strong)" }}>
                ?
              </span>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>{inv.email}</b>
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
                  invited {formatRelative(inv.created_at)} · {inv.expiresInDays > 0 ? `expires in ${inv.expiresInDays}` : "expired"}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={async () => {
                  await navigator.clipboard?.writeText(linkFor(inv.token)).catch(() => {});
                  setNotice({ tone: "ok", text: `${inv.email}'s invite link is on your clipboard.` });
                }}
              >
                Copy link
              </button>
              <button type="button" className="iconbtn" aria-label={`Withdraw the invite to ${inv.email}`} onClick={() => act(inv.id, () => fetch(`/api/invitations/${inv.id}`, { method: "DELETE" }))}>
                <IconX size={14} />
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
