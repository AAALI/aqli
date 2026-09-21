"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconX, IconChevRight } from "@/components/aqli/icons";
import Status from "./Status";
import { formatRelative } from "@/lib/utils";
import type { Backlink } from "@/lib/supabase/docs";

/** One entry in the rail's History tab. */
export type HistoryEntry = {
  id: string;
  label: string;
  who: string;
  at: string;
};

type Tab = "outline" | "citedBy" | "history";
type Heading = { text: string; sub: boolean; el: HTMLElement };

/** The paper's scroll container and the rendered body (see the doc page). */
const SCROLLER_ID = "doc-scroll";
const BODY_ID = "doc-body";

/**
 * The reading rail (v3 §2, §4).
 *
 * **Ships closed on every doc.** Closed, it is a 40px strip with a vertical
 * label; nothing about it asks to be opened. Open, it has three tabs —
 * Outline, Cited by, History — and slides over the paper rather than squeezing
 * the column, so the measure never changes under the reader.
 *
 * Deliberately not remembered across docs: the rail is something you open for
 * a reason, and the next doc should arrive as quiet as this one did.
 */
export default function ReadingRail({
  base,
  docId,
  backlinks,
  history,
}: {
  base: string;
  docId: string;
  backlinks: Backlink[];
  history: HistoryEntry[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("outline");
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState(0);
  const [minutes, setMinutes] = useState(1);

  // The outline is built from the rendered `h2`/`h3`, in document order, at
  // the moment the rail opens — the body renders client-side, so reading it
  // any earlier would find nothing.
  const buildOutline = useCallback(() => {
    const body = document.getElementById(BODY_ID);
    if (!body) return;
    const found = Array.from(body.querySelectorAll<HTMLElement>("h2, h3")).map((el) => ({
      text: el.textContent ?? "",
      sub: el.tagName === "H3",
      el,
    }));
    setHeadings(found.filter((h) => h.text.trim()));
    setActive(0);
    const words = body.textContent?.split(/\s+/).filter(Boolean).length ?? 0;
    setMinutes(Math.max(1, Math.round(words / 230)));
  }, []);

  const openRail = useCallback(
    (next: Tab = "outline") => {
      buildOutline();
      setTab(next);
      setOpen(true);
    },
    [buildOutline],
  );

  // Esc closes the rail when it is the topmost thing open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !document.querySelector(".scrim")) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function jump(i: number) {
    const h = headings[i];
    const scroller = document.getElementById(SCROLLER_ID);
    if (!h || !scroller) return;
    setActive(i);
    const top =
      h.el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top - 40), behavior: "smooth" });
  }

  if (!open) {
    return (
      <button type="button" className="rtab" aria-label="Open outline, citations and history" onClick={() => openRail()}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 6h16M4 12h10M4 18h13" />
        </svg>
        <span className="vlab">Outline</span>
      </button>
    );
  }

  return (
    <aside className="rail" aria-label="About this doc">
      <div className="rail-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "outline"} className={`rt${tab === "outline" ? " is-on" : ""}`} onClick={() => setTab("outline")}>
          Outline
        </button>
        <button type="button" role="tab" aria-selected={tab === "citedBy"} className={`rt${tab === "citedBy" ? " is-on" : ""}`} onClick={() => setTab("citedBy")}>
          Cited by
        </button>
        <button type="button" role="tab" aria-selected={tab === "history"} className={`rt${tab === "history" ? " is-on" : ""}`} onClick={() => setTab("history")}>
          History
        </button>
        <button type="button" className="rail-x" aria-label="Close" onClick={() => setOpen(false)}>
          <IconX size={15} />
        </button>
      </div>

      <div className="rail-body">
        {tab === "outline" &&
          (headings.length === 0 ? (
            <p className="rail-empty">No headings yet.</p>
          ) : (
            <>
              {headings.map((h, i) => (
                <button
                  type="button"
                  key={i}
                  className={`ol-i${h.sub ? " sub" : ""}${i === active ? " is-on" : ""}`}
                  onClick={() => jump(i)}
                >
                  {h.text}
                </button>
              ))}
              <div className="rail-foot">
                {headings.length} section{headings.length === 1 ? "" : "s"} · about {minutes} min read
              </div>
            </>
          ))}

        {tab === "citedBy" &&
          (backlinks.length === 0 ? (
            <p className="rail-empty">No other doc cites this one yet.</p>
          ) : (
            backlinks.map((b) => <CitingDoc key={b.id} base={base} doc={b} />)
          ))}

        {tab === "history" && (
          <>
            {history.length === 0 ? (
              <p className="rail-empty">No earlier versions.</p>
            ) : (
              history.slice(0, 6).map((h) => (
                <Link key={h.id} href={`${base}/docs/${docId}/history?v=${h.id}`} className="bl">
                  <b>{h.label}</b>
                  <span>
                    {h.who} · {formatRelative(h.at)}
                  </span>
                </Link>
              ))
            )}
            <div className="rail-foot">
              <Link href={`${base}/docs/${docId}/history`} style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                Every version, with what changed <IconChevRight size={12} />
              </Link>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

/** A doc that cites this one. Shared with the foot of the doc. */
export function CitingDoc({ base, doc }: { base: string; doc: Backlink }) {
  return (
    <Link href={`${base}/docs/${doc.id}`} className="bl">
      <b>{doc.title}</b>
      <span>
        <Status doc={doc} form="dot" />
        {doc.space?.name ?? "No space"}
        {doc.citesSection ? ` · cites “${doc.citesSection}”` : ""}
      </span>
    </Link>
  );
}
