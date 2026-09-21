"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconSparkle } from "@/components/aqli/icons";
import Status from "@/components/docs/Status";
import type { DocState } from "@/lib/doc-status";

type Source = { doc_id: string; doc_title: string; heading: string | null; state: DocState };
type Answer = { answer: string; sources: Source[] };

/**
 * The answer block (frame 11). Fetched after the page renders, because the
 * matches below it should not wait for a model. On failure it renders
 * nothing: the sources are already on the page, and an error card would
 * push them down to say less than they do (§4).
 */
export default function SearchAnswer({ workspaceId, base, query }: { workspaceId: string; base: string; query: string }) {
  const [data, setData] = useState<Answer | null>(null);
  const [state, setState] = useState<"loading" | "done" | "failed">("loading");

  useEffect(() => {
    let live = true;
    fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: query, workspace_id: workspaceId }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Answer) => {
        if (!live) return;
        setData(d);
        setState("done");
      })
      .catch(() => live && setState("failed"));
    return () => {
      live = false;
    };
  }, [query, workspaceId]);

  if (state === "failed") return null;
  if (state === "done" && (!data || data.sources.length === 0)) return null;

  const sources = dedupe(data?.sources ?? []);
  const allCurrent = sources.length > 0 && sources.every((s) => s.state === "current");

  return (
    <div className="card" style={{ marginTop: 22, padding: "18px 20px", borderColor: "var(--current-border)", background: "var(--current-bg)" }} aria-busy={state === "loading"}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <span style={{ color: "var(--accent)", display: "flex" }}>
          <IconSparkle size={14} />
        </span>
        <span className="eyebrow-s" style={{ color: "var(--accent)", letterSpacing: "0.13em" }}>
          {state === "loading"
            ? "Answer · reading what your team wrote"
            : `Answer · from ${sources.length} ${allCurrent ? "current " : ""}doc${sources.length === 1 ? "" : "s"}`}
        </span>
      </div>
      {state === "loading" ? (
        <div aria-hidden style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[100, 92, 60].map((w, i) => (
            <div key={i} style={{ height: 13, width: `${w}%`, borderRadius: 4, background: "rgba(15,110,86,0.1)" }} />
          ))}
        </div>
      ) : (
        <>
          <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 17.5, lineHeight: 1.7, color: "#242422", whiteSpace: "pre-wrap" }}>
            {stripSourceList(data!.answer)}
          </p>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--current-border)", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <span className="eyebrow-s" style={{ color: "var(--accent)", fontSize: 11.5, letterSpacing: "0.1em" }}>
              Because
            </span>
            {sources.map((s) => (
              <Link key={s.doc_id} href={`${base}/docs/${s.doc_id}`} style={{ fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 7, color: "var(--accent)", textDecoration: "none" }}>
                <Status state={s.state} form="dot" />
                {s.doc_title}
                {s.heading && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>§{s.heading}</span>}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function dedupe(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((s) => (seen.has(s.doc_id) ? false : (seen.add(s.doc_id), true)));
}

/** The model lists its sources in prose; "Because" already shows them. */
function stripSourceList(answer: string): string {
  return answer.replace(/\n*Sources?:\s*\[?Source[\s\S]*$/i, "").trim();
}
