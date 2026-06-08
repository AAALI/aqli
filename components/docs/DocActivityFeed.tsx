"use client";

import { useEffect, useState } from "react";
import { IconRobot, IconChevDown, IconChevRight } from "@/components/aqli/icons";
import { formatRelative } from "@/lib/utils";
import type { DocActivity } from "@/types/activity";

const ACTION_LABELS: Record<string, string> = {
  created: "created this doc",
  updated: "updated the content",
  status_changed: "changed status",
  reviewed: "marked as reviewed",
  approved: "approved this doc",
  rejected: "rejected this doc",
  changes_requested: "requested changes",
  embedded: "indexed for agent retrieval",
  review_requested: "requested human review",
};

export default function DocActivityFeed({ docId }: { docId: string }) {
  const [activities, setActivities] = useState<DocActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/docs/${docId}/activity`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setActivities(d.activities ?? []);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [docId]);

  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "16px 20px" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6, width: "100%",
          background: "transparent", border: 0, cursor: "pointer", padding: 0,
          fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)",
        }}
      >
        <span>Activity</span>
        <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
          {open ? <IconChevDown size={13} /> : <IconChevRight size={13} />}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {loading ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Loading activity…</p>
          ) : activities.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>No activity yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {activities.map((a) => (
                <div key={a.id} style={{ display: "flex", gap: 8 }}>
                  <span
                    style={{
                      flex: "0 0 18px", width: 18, height: 18, marginTop: 1,
                      borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10,
                      background: a.actor_type === "agent" ? "var(--review-bg)" : "var(--bg-base)",
                      color: a.actor_type === "agent" ? "var(--review-text)" : "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {a.actor_type === "agent" ? <IconRobot size={11} /> : "👤"}
                  </span>
                  <div style={{ minWidth: 0, fontSize: 12.5, lineHeight: 1.5 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {a.actor_name ?? (a.actor_type === "agent" ? "Agent" : "Team member")}
                    </span>{" "}
                    <span style={{ color: "var(--text-secondary)" }}>
                      {ACTION_LABELS[a.action] ?? a.action}
                    </span>
                    {typeof a.metadata?.to_status === "string" && (
                      <span style={{ color: "var(--text-muted)" }}> → {String(a.metadata.to_status)}</span>
                    )}
                    <div style={{ color: "var(--text-muted)", fontSize: 11.5, marginTop: 1 }}>
                      {formatRelative(a.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
