"use client";

import { useState } from "react";
import Link from "next/link";
import { TypeBadge } from "@/components/aqli/badges";
import { PageHeader, EmptyState } from "@/components/aqli/page";
import { IconRobot } from "@/components/aqli/icons";
import { typeLabel } from "@/lib/doc-display";
import { formatRelative } from "@/lib/utils";
import type { DocActivityWithDoc, ActivityAction } from "@/types/activity";

const ACTION_LABELS: Record<string, string> = {
  created: "created",
  updated: "updated",
  status_changed: "changed status of",
  review_requested: "requested review of",
  approved: "approved",
  rejected: "rejected",
  changes_requested: "requested changes on",
  embedded: "indexed",
  reviewed: "reviewed",
};

type Filter = "all" | "created" | "updated" | "review_requested";

const FILTERS: { key: Filter; label: string; match?: ActivityAction }[] = [
  { key: "all", label: "All Actions" },
  { key: "created", label: "Created", match: "created" },
  { key: "updated", label: "Updated", match: "updated" },
  { key: "review_requested", label: "Review Requested", match: "review_requested" },
];

export default function AgentLogClient({
  activities,
  workspaceSlug,
}: {
  activities: DocActivityWithDoc[];
  workspaceSlug: string;
}) {
  const base = `/w/${workspaceSlug}`;
  const [filter, setFilter] = useState<Filter>("all");

  const filtered =
    filter === "all"
      ? activities
      : activities.filter((a) => a.action === filter);

  return (
    <div className="content" style={{ padding: "32px 40px" }}>
      <PageHeader
        eyebrow="Audit"
        title="AI activity"
        sub="Everything AI assistants have created or changed, in one auditable trail."
      />

      <div className="fpills" style={{ marginBottom: 18 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`fpill ${filter === f.key ? "is-active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            filter === "all"
              ? "No agent has touched this workspace yet"
              : `Nothing here under "${FILTERS.find((f) => f.key === filter)?.label}"`
          }
        >
          {filter === "all" ? (
            <>
              Connect an agent with an API key and every doc it creates or changes will
              be recorded here.
            </>
          ) : (
            <>Try a different action, or switch back to All actions.</>
          )}
        </EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 900 }}>
          {filtered.map((a) => (
            <div
              key={a.id}
              className="card"
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px" }}
            >
              <span
                style={{
                  flex: "0 0 28px", width: 28, height: 28, borderRadius: 6,
                  background: "var(--review-bg)", color: "var(--review-text)", border: "1px solid var(--review-border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <IconRobot size={14} />
              </span>

              <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-primary)" }}>
                  {a.actor_name ?? a.actor_id ?? "agent"}
                </span>{" "}
                {ACTION_LABELS[a.action] ?? a.action}{" "}
                {a.doc ? (
                  <Link href={`${base}/docs/${a.doc.id}`} style={{ color: "var(--text-primary)", fontWeight: 500, textDecoration: "none" }}>
                    {a.doc.title}
                  </Link>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>a deleted doc</span>
                )}
              </div>

              {a.doc && <TypeBadge type={typeLabel(a.doc.type)} />}
              <span style={{ flexShrink: 0, fontSize: 12, color: "var(--text-muted)", width: 96, textAlign: "right" }}>
                {formatRelative(a.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
