"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconChevRight, IconRobot } from "@/components/aqli/icons";
import { markdownToTiptap } from "@/lib/markdown/md-to-tiptap";
import { avatarColor, formatRelative } from "@/lib/utils";
import { diffLines, type DiffLine } from "@/lib/merge/diff";

export type VersionView = {
  id: string;
  n: number;
  total: number;
  label: string;
  who: string;
  byAgent: boolean;
  at: string;
  prose: string;
  body_md: string;
  before: string | null;
};

/**
 * History (frame 16): the versions on the left, the change on the right in
 * the doc's own serif at 17px — removals struck through, additions tinted
 * the Current green, everything around them as it reads in the doc.
 */
export default function HistoryClient({
  workspaceSlug,
  docId,
  docTitle,
  spaceName,
  spaceSlug,
  versions,
  initial,
  canRestore,
}: {
  workspaceSlug: string;
  docId: string;
  docTitle: string;
  spaceName: string | null;
  spaceSlug: string | null;
  versions: VersionView[];
  initial: string | null;
  canRestore: boolean;
}) {
  const router = useRouter();
  const base = `/w/${workspaceSlug}`;
  const [selectedId, setSelectedId] = useState<string | null>(
    (initial && versions.some((v) => v.id === initial) ? initial : versions[0]?.id) ?? null,
  );
  const [busy, setBusy] = useState(false);
  const selected = versions.find((v) => v.id === selectedId) ?? null;
  const isLatest = selected?.id === versions[0]?.id;

  const blocks = useMemo(() => (selected ? toBlocks(diffLines(selected.before ?? "", selected.body_md)) : []), [selected]);

  async function restore() {
    if (!selected) return;
    setBusy(true);
    try {
      await fetch(`/api/docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body_md: selected.body_md, body_json: markdownToTiptap(selected.body_md) }),
      });
      router.push(`${base}/docs/${docId}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="tb">
        <nav className="tb-crumb" aria-label="Breadcrumb">
          {spaceSlug && (
            <>
              <Link href={`${base}/s/${spaceSlug}`}>{spaceName}</Link>
              <span className="crumb-sep"><IconChevRight size={12} /></span>
            </>
          )}
          <Link href={`${base}/docs/${docId}`}>{docTitle}</Link>
          <span className="crumb-sep"><IconChevRight size={12} /></span>
          <span className="crumb-cur">History</span>
        </nav>
        <div className="tb-spacer" />
        <Link href={`${base}/docs/${docId}`} className="btn btn-ghost">
          Back to the doc
        </Link>
      </div>

      <div className="main-body">
        <aside className="hist-list" aria-label="Versions">
          {versions.length === 0 ? (
            <p className="rail-empty" style={{ padding: "0 12px" }}>
              No versions yet. One is kept every time a change is merged.
            </p>
          ) : (
            versions.map((v) => (
              <button
                type="button"
                key={v.id}
                className={`bl hist-i${v.id === selectedId ? " is-on" : ""}`}
                aria-current={v.id === selectedId}
                onClick={() => setSelectedId(v.id)}
              >
                <b>
                  v{v.n} · {v.label}
                </b>
                <span>
                  <span
                    className="avatar"
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      flexBasis: 20,
                      fontSize: 9,
                      ...(v.byAgent
                        ? { background: "var(--unver-bg)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
                        : { background: avatarColor(v.who) }),
                    }}
                  >
                    {v.byAgent ? <IconRobot size={11} /> : v.who.charAt(0).toUpperCase()}
                  </span>
                  {v.who} · {formatRelative(v.at)}
                </span>
              </button>
            ))
          )}
        </aside>

        <div className="doc-scroll">
          {selected && (
            <article className="doc-col" style={{ paddingTop: 36, maxWidth: 660 }}>
              <p className="ob-eb" style={{ margin: 0 }}>
                Version {selected.n} of {selected.total} · {formatRelative(selected.at)}
              </p>
              <h1 className="dt" style={{ fontSize: 30, marginTop: 8 }}>
                {selected.label}
              </h1>
              <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "var(--text-secondary)" }}>{selected.prose}</p>

              <div className="dbody hist-diff" style={{ marginTop: 28, fontSize: 17 }}>
                {blocks.map((b, i) => (
                  <Block key={i} block={b} />
                ))}
              </div>

              {canRestore && !isLatest && (
                <div style={{ marginTop: 32, display: "flex", gap: 9 }}>
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={restore}>
                    {busy ? "Restoring…" : "Restore this version"}
                  </button>
                </div>
              )}
            </article>
          )}
        </div>
      </div>
    </>
  );
}

type Segment = { op: "context" | "add" | "remove"; text: string };
type BlockT = { kind: "h2" | "h3" | "p"; segments: Segment[] };

/**
 * Group diff lines into the blocks they belong to, so a changed sentence
 * reads inside its paragraph rather than as a line in a patch. Unchanged
 * stretches far from any change are dropped to keep the eye on the change.
 */
function toBlocks(lines: DiffLine[]): BlockT[] {
  const near = new Array(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.op === "context") return;
    for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) near[j] = true;
  });
  const out: BlockT[] = [];
  let para: Segment[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "p", segments: para });
    para = [];
  };
  lines.forEach((l, i) => {
    const heading = l.text.match(/^(#{1,3})\s+(.+)$/);
    const keep = near[i] || heading;
    if (!l.text.trim()) return flush();
    if (!keep) return;
    if (heading) {
      flush();
      out.push({ kind: heading[1].length >= 3 ? "h3" : "h2", segments: [{ op: l.op, text: heading[2] }] });
      return;
    }
    para.push({ op: l.op, text: l.text.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "• ") });
  });
  flush();
  return out;
}

function Block({ block }: { block: BlockT }) {
  const inner = block.segments.map((s, i) => (
    <span key={i}>
      {i > 0 && " "}
      <span className={s.op === "add" ? "d-add" : s.op === "remove" ? "d-rem" : undefined}>{s.text.replace(/[*_`]/g, "")}</span>
    </span>
  ));
  if (block.kind === "h2") return <h2 style={{ fontSize: 20 }}>{inner}</h2>;
  if (block.kind === "h3") return <h3>{inner}</h3>;
  return <p>{inner}</p>;
}
