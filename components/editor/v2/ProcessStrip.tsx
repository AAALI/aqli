"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RequestReviewButton from "@/components/docs/RequestReviewButton";
import { StatusBadge } from "@/components/aqli/badges";
import { IconHistory } from "@/components/aqli/icons";
import { DOC_TYPES, type DocType, type DocWithSpace } from "@/types/doc";
import { statusLabel, typeLabel } from "@/lib/doc-display";
import type { Space } from "@/types/space";

/** "Sara", "Sara and Amir", "Sara, Amir and 2 others". */
function notifyList(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length === 3 ? "" : "s"}`;
}

/**
 * The editor's bottom strip: what happens to this doc when you stop typing.
 *
 * Deliberately not a status readout. It used to open with
 * "Editing · Sara · Saved just now", which restated the breadcrumb's save
 * state and the meta row's status for a third time on the same screen. What
 * is left is the process — who owns it, who hears about it at review, and the
 * three things you can do about that.
 */
export default function ProcessStrip({
  doc,
  base,
  ownerName,
  reviewers,
}: {
  doc: DocWithSpace;
  base: string;
  ownerName: string | null;
  /** Who gets the review request — workspace admins and editors. */
  reviewers: string[];
}) {
  // This strip owns the bottom-right corner while the editor is open, so lift
  // the floating assistant clear of it. The default keeps the pill at 24px
  // everywhere else.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--dock-bottom", "70px");
    return () => {
      root.style.removeProperty("--dock-bottom");
    };
  }, []);

  const notify = notifyList(reviewers);

  return (
    <div className="pstrip ed2-processstrip">
      {/* The same status fact as the meta row above the title, in the place
          you act on it. Nothing else on this strip repeats. */}
      <StatusBadge status={statusLabel(doc.status)} />
      {ownerName && (
        <>
          <span className="ed2-strip-status">·</span>
          <span className="ed2-strip-status">{ownerName}</span>
        </>
      )}
      {notify && (
        <>
          <span className="ed2-strip-status">·</span>
          <span className="ed2-strip-status">Will notify on review {notify}</span>
        </>
      )}

      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Link
          href={`${base}/docs/${doc.id}/history`}
          className="btn btn-ghost"
          style={{ height: 28, fontSize: 12, gap: 6 }}
        >
          <IconHistory size={12} />
          History
        </Link>
        <DocSettingsButton doc={doc} />
        {doc.status === "draft" && <RequestReviewButton docId={doc.id} />}
      </span>
    </div>
  );
}

/** The old DocMeta fields (type, tags, linked URL), tucked behind one button. */
function DocSettingsButton({ doc }: { doc: DocWithSpace }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DocType>(doc.type);
  const [tagsText, setTagsText] = useState((doc.frontmatter?.tags ?? []).join(", "));
  const [linkedUrl, setLinkedUrl] = useState(doc.frontmatter?.linked_project_url ?? "");
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState(doc.space_id);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch available spaces when modal opens
  useEffect(() => {
    if (open) {
      async function fetchSpaces() {
        try {
          const res = await fetch(`/api/spaces?workspace_id=${doc.workspace_id}`);
          if (res.ok) {
            const data = await res.json();
            setSpaces(data.spaces || []);
          }
        } catch (err) {
          console.error("Failed to fetch spaces:", err);
        }
      }
      fetchSpaces();
    }
  }, [open, doc.workspace_id]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function save() {
    setBusy(true);
    try {
      await fetch(`/api/docs/${doc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          space_id: selectedSpaceId,
          frontmatter: {
            ...doc.frontmatter,
            tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
            linked_project_url: linkedUrl,
          },
        }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    height: 30,
    padding: "0 10px",
    fontSize: 13,
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "var(--font-sans)",
    width: "100%",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="btn btn-ghost"
        style={{ height: 28, fontSize: 12 }}
        onClick={() => setOpen((o) => !o)}
      >
        Settings
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: 36,
            right: 0,
            width: 300,
            background: "var(--bg-card)",
            border: "1px solid var(--border-strong)",
            borderRadius: 10,
            boxShadow: "0 12px 32px -8px rgba(20,20,18,0.22)",
            padding: 14,
            zIndex: 40,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Type
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocType)}
              style={fieldStyle}
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Tags
            </span>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="tags, comma, separated"
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Linked project URL
            </span>
            <input
              value={linkedUrl}
              onChange={(e) => setLinkedUrl(e.target.value)}
              placeholder="Linear / GitHub project URL"
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Space
            </span>
            <select
              value={selectedSpaceId ?? ""}
              onChange={(e) => setSelectedSpaceId(e.target.value || null)}
              style={fieldStyle}
            >
              <option value="">No space</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.icon} {space.name}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 2 }}>
            <button className="btn btn-ghost" style={{ height: 28, fontSize: 12 }} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" style={{ height: 28, fontSize: 12 }} onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
