"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DocType } from "@/types/doc";
import AppTopBar from "@/components/layout/AppTopBar";
import { IconPlus, IconX } from "@/components/aqli/icons";
import { templateFor } from "@/components/editor/templates";
import { tiptapToMarkdown } from "@/lib/markdown/tiptap-to-md";

type TypeDef = {
  id: DocType;
  code: string;
  name: string;
  desc: string;
  sections: string[];
};

const TYPES: TypeDef[] = [
  {
    id: "prd",
    code: "PRD",
    name: "Product requirement",
    desc: "Problem, goals, non-goals, user flow, requirements.",
    sections: ["Problem", "Goals", "Non-goals", "User stories", "Requirements — P0", "Requirements — P1", "Open questions", "Success metrics"],
  },
  {
    id: "adr",
    code: "ADR",
    name: "Architecture decision",
    desc: "Context, decision, alternatives, consequences.",
    sections: ["Context", "Decision", "Alternatives considered", "Consequences", "Open questions"],
  },
  {
    id: "runbook",
    code: "RUN",
    name: "Runbook",
    desc: "Operational playbook — symptoms, checks, fix, escalate.",
    sections: ["Symptoms", "First checks", "The fix", "Escalation", "Related dashboards"],
  },
  {
    id: "fix_note",
    code: "FIX",
    name: "Fix note",
    desc: "What broke, root cause, the change, follow-ups.",
    sections: ["What broke", "Root cause", "The fix", "Verification", "Follow-ups"],
  },
  {
    id: "compliance",
    code: "POL",
    name: "Compliance / policy",
    desc: "Scope, rules, exceptions, audit trail.",
    sections: ["Scope", "Rules", "Exceptions", "Audit trail"],
  },
  {
    id: "decision",
    code: "DEC",
    name: "Decision log",
    desc: "One-off decision with rationale and date.",
    sections: ["Decision", "Rationale", "Date & owner"],
  },
  {
    id: "general",
    code: "DOC",
    name: "General doc",
    desc: "Blank canvas — no scaffolding.",
    sections: [],
  },
];

export default function NewDocClient({
  workspaceId,
  workspaceSlug,
  spaceId,
  spaceName,
  spaceSlug,
}: {
  workspaceId: string;
  workspaceSlug: string;
  spaceId: string;
  spaceName: string;
  spaceSlug: string;
}) {
  const router = useRouter();
  const base = `/w/${workspaceSlug}`;
  const [selected, setSelected] = useState<TypeDef>(TYPES[0]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const template = templateFor(selected.id);
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          space_id: spaceId,
          title: title.trim() || "Untitled",
          type: selected.id,
          ...(template
            ? {
                body_json: template,
                body_md: tiptapToMarkdown(template as Record<string, unknown>),
              }
            : {}),
        }),
      });
      if (res.ok) {
        const { doc } = await res.json();
        router.replace(`${base}/docs/${doc.id}/edit`);
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  }

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: spaceName, href: `${base}/s/${spaceSlug}` }, { label: "New doc" }]} />
      <div className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 880,
            maxWidth: "100%",
            height: 560,
            maxHeight: "100%",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "0 18px 48px -12px rgba(20,20,18,0.18), 0 2px 6px rgba(20,20,18,0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em" }}>
                New doc in {spaceName}
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                Pick a type. The doc starts with a template you can edit or strip.
              </p>
            </div>
            <Link href={`${base}/s/${spaceSlug}`} className="iconbtn" aria-label="Cancel">
              <IconX size={18} />
            </Link>
          </div>

          {/* Body: type list + preview */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr", minHeight: 0 }}>
            <div style={{ padding: "12px 8px", borderRight: "1px solid var(--border)", background: "var(--bg-base)", overflow: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {TYPES.map((t) => (
                <TypeTile key={t.id} t={t} selected={t.id === selected.id} onSelect={() => setSelected(t)} />
              ))}
            </div>

            <div style={{ padding: "20px 24px", overflow: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={typeChip(true)}>{selected.code}</span>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.005em" }}>{selected.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {selected.sections.length ? `${selected.sections.length} sections of scaffolding` : "Blank canvas — start from scratch"}
                  </span>
                </div>
              </div>

              <div style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 10, flex: 1, overflow: "auto" }}>
                {selected.sections.length ? (
                  selected.sections.map((s, i) => (
                    <div key={i} style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--text-primary)", letterSpacing: "-0.01em", marginTop: i > 0 ? 8 : 0 }}>
                      {s}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No scaffolding — a clean page to write whatever you need.</div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>Title</span>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && create()}
                  placeholder="Untitled"
                  style={{
                    height: 44,
                    padding: "0 14px",
                    background: "var(--bg-base)",
                    border: "1px solid var(--accent)",
                    boxShadow: "0 0 0 3px rgba(15,110,86,0.12)",
                    borderRadius: 8,
                    fontFamily: "var(--font-serif)",
                    fontSize: 18,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.01em",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              You can change the type and template anytime while editing.
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <Link href={`${base}/s/${spaceSlug}`} className="btn btn-ghost">Cancel</Link>
              <button className="btn btn-primary" onClick={create} disabled={busy}>
                <IconPlus size={13} sw={2} />
                <span>{busy ? "Creating…" : "Create doc"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function typeChip(selected: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 6,
    background: selected ? "var(--accent-light)" : "var(--bg-card)",
    color: selected ? "var(--accent)" : "var(--text-secondary)",
    fontFamily: "var(--font-mono)",
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: "0.04em",
    border: `1px solid ${selected ? "rgba(15,110,86,0.2)" : "var(--border)"}`,
  };
}

function TypeTile({ t, selected, onSelect }: { t: TypeDef; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: "grid",
        gridTemplateColumns: "36px 1fr",
        gap: 10,
        padding: "10px 12px",
        background: selected ? "var(--bg-card)" : "transparent",
        border: `1px solid ${selected ? "var(--border-strong)" : "transparent"}`,
        borderRadius: 8,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font-sans)",
        alignItems: "center",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 6,
          background: selected ? "var(--accent-light)" : "var(--bg-card)",
          color: selected ? "var(--accent)" : "var(--text-secondary)",
          border: `1px solid ${selected ? "rgba(15,110,86,0.2)" : "var(--border)"}`,
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}
      >
        {t.code}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: selected ? "var(--accent)" : "var(--text-primary)", letterSpacing: "-0.005em" }}>
          {t.name}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t.desc}
        </span>
      </div>
    </button>
  );
}
