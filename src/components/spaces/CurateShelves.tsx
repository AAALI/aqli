"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DocOption = { id: string; title: string };

/**
 * "Edit" on a space's Start here (frame 08): pick up to three docs to lead
 * with, and the ones a newcomer should read, in order. Order is the order
 * you tick them in. A sheet, like every other set of choices in v3.
 */
export default function CurateShelves({
  spaceId,
  docs,
  startHere,
  readingPath,
}: {
  spaceId: string;
  docs: DocOption[];
  startHere: string[];
  readingPath: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string[]>(startHere);
  const [path, setPath] = useState<string[]>(readingPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, id: string, max: number) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : list.length < max ? [...list, id] : list);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/spaces/${spaceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_here: start, reading_path: path }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Couldn't save. Try again.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="sect-a" style={{ background: "none", border: 0, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setOpen(true)}>
        Edit
      </button>
      {open && (
        <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Edit this space's shelves" style={{ width: 520 }}>
            <div className="sheet-h">
              <h3>What should people read first?</h3>
              <p>Up to three docs lead the space. The reading path is what a newcomer reads, in the order you tick them.</p>
            </div>
            <div className="sheet-b" style={{ maxHeight: 420, overflow: "auto" }}>
              {[
                { label: "Start here · up to three", list: start, set: setStart, max: 3 },
                { label: "Reading path · in order", list: path, set: setPath, max: 12 },
              ].map((g) => (
                <div key={g.label}>
                  <span className="fl">{g.label}</span>
                  <div className="pickrow">
                    {docs.map((d) => {
                      const at = g.list.indexOf(d.id);
                      return (
                        <button
                          type="button"
                          key={d.id}
                          aria-pressed={at >= 0}
                          className={`pick${at >= 0 ? " is-on" : ""}`}
                          onClick={() => toggle(g.list, g.set, d.id, g.max)}
                        >
                          {at >= 0 && g.max > 3 && <span className="ty" style={{ color: "inherit" }}>{at + 1}</span>}
                          {d.title || "Untitled"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "var(--ageing-text)" }}>{error}</p>}
            </div>
            <div className="sheet-f">
              <span style={{ flex: 1 }} />
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
