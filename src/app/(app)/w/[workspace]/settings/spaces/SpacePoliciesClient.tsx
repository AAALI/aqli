"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsHeader } from "@/components/settings/primitives";
import type { ReviewPolicy } from "@/lib/merge/disposition";

type SpaceRow = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  review_policy: ReviewPolicy;
  visibility: "open" | "private";
};

/**
 * Copy is written from `decideDisposition` in lib/merge/disposition.ts, which
 * is the TypeScript twin of `app.decide_disposition`. If the truth table
 * changes, these descriptions are wrong — they are the only place a user ever
 * sees what the rule does.
 */
const POLICIES: {
  value: ReviewPolicy;
  label: string;
  description: string;
}[] = [
  {
    value: "open",
    label: "Open",
    description:
      "Everything lands immediately. People and agents both write straight into the space.",
  },
  {
    value: "review_agents",
    label: "Agents reviewed",
    description:
      "People write directly. Agent changes wait in the review queue, unless that agent's key carries the write scope.",
  },
  {
    value: "review_all",
    label: "Everything reviewed",
    description:
      "Every change queues for approval, including one made by a person. For policy, legal and compliance spaces.",
  },
];

const selectStyle: React.CSSProperties = {
  height: 34,
  padding: "0 32px 0 12px",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  color: "var(--text-primary)",
  cursor: "pointer",
  outline: "none",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
};

export default function SpacePoliciesClient({
  canManage,
  initialSpaces,
  workspaceMembers = [],
}: {
  canManage: boolean;
  /** Everyone in the workspace, for the private-space roster. */
  workspaceMembers?: { user_id: string; email: string; full_name: string | null }[];
  initialSpaces: SpaceRow[];
}) {
  const router = useRouter();
  const [spaces, setSpaces] = useState(initialSpaces);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setPolicy(space: SpaceRow, policy: ReviewPolicy) {
    if (policy === space.review_policy) return;
    const previous = space.review_policy;

    // Optimistic: the select is the control, so it has to move under the
    // cursor immediately. Reverted below if the write is refused.
    setSpaces((prev) =>
      prev.map((s) => (s.id === space.id ? { ...s, review_policy: policy } : s)),
    );
    setBusy(space.id);
    setError(null);

    try {
      const res = await fetch(`/api/spaces/${space.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_policy: policy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update this space");
      setSaved(space.id);
      setTimeout(() => setSaved((id) => (id === space.id ? null : id)), 2500);
      router.refresh();
    } catch (e) {
      setSpaces((prev) =>
        prev.map((s) => (s.id === space.id ? { ...s, review_policy: previous } : s)),
      );
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const [rosterFor, setRosterFor] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);

  /** Fetched when someone opens a roster — never in an effect, never up front. */
  async function loadRoster(spaceId: string) {
    setRoster(null);
    setRosterError(null);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/members`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the members");
      setRoster(data.members as RosterEntry[]);
    } catch (e) {
      setRosterError(e instanceof Error ? e.message : "Something went wrong");
      setRoster([]);
    }
  }

  async function setRosterRole(
    spaceId: string,
    userId: string,
    role: "member" | "reviewer" | null,
  ) {
    setBusy(spaceId);
    setRosterError(null);
    try {
      const res =
        role === null
          ? await fetch(`/api/spaces/${spaceId}/members?user_id=${userId}`, { method: "DELETE" })
          : await fetch(`/api/spaces/${spaceId}/members`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: userId, role }),
            });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update the members");
      await loadRoster(spaceId);
    } catch (e) {
      setRosterError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  /**
   * Making a space private hides it from everyone who is not in it — including
   * from assistants, whose reads inherit the visibility of whoever owns the
   * key. An admin who is not a member loses their own access too, which is why
   * the confirmation says so rather than assuming it is obvious.
   */
  async function setVisibility(space: SpaceRow, visibility: SpaceRow["visibility"]) {
    if (visibility === space.visibility) return;
    const previous = space.visibility;

    setSpaces((prev) => prev.map((s) => (s.id === space.id ? { ...s, visibility } : s)));
    setBusy(space.id);
    setError(null);

    try {
      const res = await fetch(`/api/spaces/${space.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update this space");
      setSaved(space.id);
      setTimeout(() => setSaved(null), 1600);
    } catch (e) {
      setSpaces((prev) =>
        prev.map((s) => (s.id === space.id ? { ...s, visibility: previous } : s)),
      );
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="content" style={{ padding: "32px 44px", overflow: "auto" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <SettingsHeader
          title="Spaces"
          sub="Who can read a space, and who has to approve a change before it becomes part of one. Approvals happen in the review queue; nothing is lost while it waits."
          action={
            error ? (
              <span style={{ fontSize: 12.5, color: "#993C1D" }}>{error}</span>
            ) : null
          }
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {spaces.map((space) => {
            const policy = POLICIES.find((p) => p.value === space.review_policy);
            return (
              <div
                key={space.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr 150px 210px",
                  gap: 16,
                  alignItems: "center",
                  padding: "16px 20px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "var(--bg-sidebar)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                  }}
                >
                  {space.icon}
                </span>

                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 14.5,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {space.name}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                    {policy?.description}
                  </span>
                </div>

                <div style={{ justifySelf: "end" }}>
                  <select
                    value={space.visibility}
                    disabled={!canManage || busy === space.id}
                    onChange={(e) => setVisibility(space, e.target.value as SpaceRow["visibility"])}
                    style={{ ...selectStyle, opacity: canManage ? 1 : 0.6, minWidth: 130 }}
                    title={
                      space.visibility === "private"
                        ? "Only members of this space can read it — in the app, in search, and through any assistant."
                        : "Everyone in the workspace can read this space."
                    }
                  >
                    <option value="open">Everyone</option>
                    <option value="private">Members only</option>
                  </select>
                  {space.visibility === "private" && (
                    <button
                      type="button"
                      onClick={() => {
                        const opening = rosterFor !== space.id;
                        setRosterFor(opening ? space.id : null);
                        if (opening) void loadRoster(space.id);
                      }}
                      style={{
                        display: "block",
                        marginTop: 6,
                        fontSize: 12,
                        background: "none",
                        border: 0,
                        padding: 0,
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      {rosterFor === space.id ? "Hide members" : "Members"}
                    </button>
                  )}
                </div>

                <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 10 }}>
                  {saved === space.id && (
                    <span style={{ fontSize: 12, color: "var(--approved-text)" }}>Saved</span>
                  )}
                  <select
                    value={space.review_policy}
                    disabled={!canManage || busy === space.id}
                    onChange={(e) => setPolicy(space, e.target.value as ReviewPolicy)}
                    style={{ ...selectStyle, opacity: canManage ? 1 : 0.6 }}
                  >
                    {POLICIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                {rosterFor === space.id && (
                  <div style={{ gridColumn: "1 / -1", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <SpaceRoster
                      entries={roster}
                      canManage={canManage}
                      busy={busy === space.id}
                      error={rosterError}
                      workspaceMembers={workspaceMembers}
                      onSet={(userId, role) => void setRosterRole(space.id, userId, role)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!canManage && (
          <p
            style={{
              fontSize: 12.5,
              color: "var(--text-muted)",
              textAlign: "center",
              paddingTop: 18,
            }}
          >
            Only workspace admins can change a space&apos;s review policy.
          </p>
        )}
      </div>
    </div>
  );
}

type RosterEntry = { user_id: string; role: "member" | "reviewer" };

/**
 * Who is in a private space, and who may approve in it.
 *
 * Controlled: the parent fetches when someone opens the roster, so nothing is
 * loaded in an effect and a space nobody opened costs no query. Most spaces are
 * open and have no roster to show at all.
 *
 * Naming a reviewer is what completes `review_all` — the policy could say
 * "everything waits for approval" but never said whose. A space with no named
 * reviewer keeps the old behaviour, so this is opt-in rather than a silent
 * change to who can unblock a queue.
 */
function SpaceRoster({
  entries,
  canManage,
  busy,
  error,
  workspaceMembers,
  onSet,
}: {
  entries: RosterEntry[] | null;
  canManage: boolean;
  busy: boolean;
  error: string | null;
  workspaceMembers: { user_id: string; email: string; full_name: string | null }[];
  onSet: (userId: string, role: "member" | "reviewer" | null) => void;
}) {
  if (!entries) {
    return <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Loading members…</p>;
  }

  const roleOf = (userId: string) => entries.find((e) => e.user_id === userId)?.role ?? null;

  return (
    <div>
      <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>
        Only these people can read this space — in the app, in search, and through any assistant,
        which inherits the space membership of whoever owns its key. A <strong>reviewer</strong> can
        also approve proposals here; if nobody is named, any editor or admin can, as before.
      </p>
      {error && (
        <p style={{ fontSize: 12.5, color: "var(--danger-fg, #b91c1c)", marginBottom: 8 }}>{error}</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {workspaceMembers.map((member) => {
          const role = roleOf(member.user_id);
          return (
            <div
              key={member.user_id}
              style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                {member.full_name || member.email}
                {member.full_name && (
                  <span style={{ color: "var(--text-muted)", marginLeft: 6, fontSize: 12 }}>
                    {member.email}
                  </span>
                )}
              </span>
              <select
                value={role ?? "none"}
                disabled={!canManage || busy}
                onChange={(e) =>
                  onSet(
                    member.user_id,
                    e.target.value === "none" ? null : (e.target.value as "member" | "reviewer"),
                  )
                }
                style={{ ...selectStyle, minWidth: 140, opacity: canManage ? 1 : 0.6 }}
              >
                <option value="none">No access</option>
                <option value="member">Member</option>
                <option value="reviewer">Reviewer</option>
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
