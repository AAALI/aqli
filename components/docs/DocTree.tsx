"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconChevRight, IconChevDown, IconFile } from "@/components/aqli/icons";
import { buildDocTree, flattenTree, canMoveUnder, type TreeRow } from "@/lib/doc-tree";

export type DocTreeItem = TreeRow & { status: string; updated_at: string };

/**
 * Which nodes are open is per-viewer preference, so it lives in localStorage
 * rather than in the database — and is therefore read through
 * `useSyncExternalStore`, not copied into state by an effect. Storage is the
 * value; the component renders it.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readExpanded(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // A browser with site data blocked still gets a working tree.
    return null;
  }
}

function writeExpanded(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Not remembering the shape of the tree is survivable.
  }
  for (const listener of listeners) listener();
}

/**
 * The page tree for a space: expand, collapse, and drag to re-parent or
 * reorder.
 *
 * Drag and drop is the browser's own HTML5 API rather than a library. The
 * worker has a hard bundle ceiling (C4) and a dependency for this would cost
 * more than the feature; the interactions that matter here — pick a row, drop
 * it on another row or between two — are what the native API is for.
 *
 * The database is the authority on whether a move is legal. `canMoveUnder`
 * only exists so an illegal drop is refused while the row is still in the
 * hand, instead of being accepted and then bouncing back.
 */
export default function DocTree({
  docs,
  base,
  spaceSlug,
}: {
  docs: DocTreeItem[];
  base: string;
  spaceSlug: string;
}) {
  const router = useRouter();
  const tree = useMemo(() => buildDocTree(docs), [docs]);

  const storageKey = `aqli:tree:${spaceSlug}`;
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropInto, setDropInto] = useState<string | null>(null);
  const [dropBefore, setDropBefore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stored = useSyncExternalStore(
    subscribe,
    useCallback(() => readExpanded(storageKey), [storageKey]),
    // The server has no storage to read, and neither does the first client
    // render: both start from the default below, so hydration matches.
    () => null,
  );

  // Everything with children starts open. A tree that opens collapsed looks
  // like a short flat list, which is the state this feature exists to fix.
  // What the reader then opens or closes is remembered per space.
  const expanded = useMemo(() => {
    if (stored) {
      try {
        return new Set(JSON.parse(stored) as string[]);
      } catch {
        // Corrupt entry: fall through to the default rather than blowing up.
      }
    }
    return new Set(docs.filter((d) => docs.some((c) => c.parent_doc_id === d.id)).map((d) => d.id));
  }, [stored, docs]);

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeExpanded(storageKey, [...next]);
  }

  /** Open a node without waiting for a render pass — used after a drop. */
  function reveal(id: string) {
    if (expanded.has(id)) return;
    writeExpanded(storageKey, [...expanded, id]);
  }

  const rows = flattenTree(tree, expanded);

  async function move(docId: string, parentId: string | null, position: number | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/docs/${docId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: parentId, position }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "That move was refused.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
      setDragging(null);
      setDropInto(null);
      setDropBefore(null);
    }
  }

  function onDropInto(targetId: string) {
    if (!dragging || dragging === targetId) return;
    if (!canMoveUnder(docs, dragging, targetId)) {
      setError("A page cannot be moved inside one of its own sub-pages.");
      setDragging(null);
      setDropInto(null);
      return;
    }
    // Dropping onto a row makes the dragged page its last child, and opens it
    // so the page does not appear to vanish.
    reveal(targetId);
    void move(dragging, targetId, null);
  }

  function onDropBefore(target: DocTreeItem) {
    if (!dragging || dragging === target.id) return;
    const parentId = target.parent_doc_id;
    if (!canMoveUnder(docs, dragging, parentId)) {
      setError("A page cannot be moved inside one of its own sub-pages.");
      setDragging(null);
      setDropBefore(null);
      return;
    }
    const siblings = docs
      .filter((d) => d.parent_doc_id === parentId && d.id !== dragging)
      .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
    void move(dragging, parentId, Math.max(siblings.findIndex((s) => s.id === target.id), 0));
  }

  if (docs.length === 0) return null;

  return (
    <div style={{ opacity: busy ? 0.6 : 1, transition: "opacity 120ms" }}>
      {error && (
        <div
          role="alert"
          style={{
            fontSize: 12.5,
            color: "var(--danger-fg, #b91c1c)",
            background: "var(--danger-bg, #fee2e2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "7px 10px",
            marginBottom: 10,
          }}
        >
          {error}
        </div>
      )}

      <div
        // Dropping below everything makes a page a root again, which is
        // otherwise only reachable by dragging onto a top-level row.
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => dragging && void move(dragging, null, null)}
      >
        {rows.map((node) => {
          const hasChildren = node.children.length > 0;
          const isOpen = expanded.has(node.id);
          return (
            <div key={node.id}>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropBefore(node.id);
                  setDropInto(null);
                }}
                onDragLeave={() => setDropBefore((id) => (id === node.id ? null : id))}
                onDrop={(e) => {
                  e.stopPropagation();
                  onDropBefore(node);
                }}
                style={{
                  height: 6,
                  marginLeft: 8 + node.depth * 16,
                  borderTop: dropBefore === node.id ? "2px solid var(--accent)" : "2px solid transparent",
                }}
              />

              <div
                draggable
                onDragStart={() => {
                  setDragging(node.id);
                  setError(null);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setDropInto(null);
                  setDropBefore(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropInto(node.id);
                  setDropBefore(null);
                }}
                onDragLeave={() => setDropInto((id) => (id === node.id ? null : id))}
                onDrop={(e) => {
                  e.stopPropagation();
                  onDropInto(node.id);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 8px",
                  marginLeft: node.depth * 16,
                  borderRadius: 6,
                  cursor: "grab",
                  opacity: dragging === node.id ? 0.45 : 1,
                  background: dropInto === node.id ? "var(--bg-hover, rgba(0,0,0,0.04))" : "transparent",
                  outline: dropInto === node.id ? "1px solid var(--accent)" : "none",
                }}
              >
                <button
                  type="button"
                  onClick={() => hasChildren && toggle(node.id)}
                  aria-label={hasChildren ? (isOpen ? "Collapse" : "Expand") : undefined}
                  aria-expanded={hasChildren ? isOpen : undefined}
                  disabled={!hasChildren}
                  style={{
                    width: 18,
                    height: 18,
                    display: "grid",
                    placeItems: "center",
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    color: "var(--text-muted)",
                    cursor: hasChildren ? "pointer" : "default",
                    visibility: hasChildren ? "visible" : "hidden",
                  }}
                >
                  {isOpen ? <IconChevDown size={13} /> : <IconChevRight size={13} />}
                </button>

                <span style={{ color: "var(--text-muted)", display: "grid", placeItems: "center" }}>
                  <IconFile size={13} />
                </span>

                <Link
                  href={`${base}/docs/${node.id}`}
                  style={{ fontSize: 13.5, color: "var(--text-primary)", textDecoration: "none", flex: 1 }}
                >
                  {node.title || "Untitled"}
                </Link>

                {hasChildren && !isOpen && (
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {node.children.length}
                  </span>
                )}
                {node.status === "draft" && (
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Draft</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14 }}>
        Drag a page onto another to make it a sub-page, or between two to reorder. Dropping below
        the list moves it back to the top level.
      </p>
    </div>
  );
}
