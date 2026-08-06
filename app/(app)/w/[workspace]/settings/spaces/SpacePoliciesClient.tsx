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
}: {
  canManage: boolean;
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

  return (
    <div className="content" style={{ padding: "32px 44px", overflow: "auto" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <SettingsHeader
          title="Spaces"
          sub="Who has to approve a change before it becomes part of a space. Approvals happen in the review queue; nothing is lost while it waits."
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
                  gridTemplateColumns: "36px 1fr 210px",
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
