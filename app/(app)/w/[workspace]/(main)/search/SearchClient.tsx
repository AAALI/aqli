"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AppTopBar from "@/components/layout/AppTopBar";
import { StatusBadge, TypeBadge } from "@/components/aqli/badges";
import { IconSearch, IconSparkle, IconArrowUpRight, IconRobot } from "@/components/aqli/icons";
import { typeLabel, statusLabel } from "@/lib/doc-display";
import type { DocStatus, DocType } from "@/types/doc";

type Result = {
  id: string;
  title: string;
  type: DocType;
  status: DocStatus;
  space_id: string | null;
  author_type?: "human" | "agent";
  updated_at: string;
  body_md: string | null;
};

function excerptParts(body: string | null, query: string): [string, string, string] {
  if (!body) return ["", "", ""];
  const term = query.split(/\s+/)[0]?.toLowerCase() ?? "";
  const idx = term ? body.toLowerCase().indexOf(term) : -1;
  if (idx < 0) return ["", "", (body.slice(0, 180).trim() + "…")];
  const start = idx > 50 ? idx - 50 : 0;
  const pre = (start > 0 ? "…" : "") + body.slice(start, idx);
  const match = body.slice(idx, idx + term.length);
  const post = body.slice(idx + term.length, idx + term.length + 120).trim() + "…";
  return [pre, match, post];
}

type AiAnswer = {
  answer: string;
  sources: { doc_id: string; doc_title: string; heading: string | null; source_url: string | null; score: number }[];
} | null;

export default function SearchClient({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string;
  workspaceSlug: string;
}) {
  const base = `/w/${workspaceSlug}`;
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ms, setMs] = useState(0);
  const [aiAnswer, setAiAnswer] = useState<AiAnswer>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setBusy(true);
      setAiAnswer(null);
      const t0 = performance.now();
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&workspace_id=${workspaceId}`,
        );
        const data = await res.json();
        setResults(data.results ?? []);
        setMs(Math.round(performance.now() - t0));
        setSearched(true);
      } finally {
        setBusy(false);
      }

      // Fire AI Ask in parallel — don't block the search results
      setAiLoading(true);
      try {
        const aiRes = await fetch("/api/ai/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, workspace_id: workspaceId }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          setAiAnswer({ answer: aiData.answer, sources: aiData.sources ?? [] });
        }
      } catch {
        // AI ask is best-effort; search results already shown
      } finally {
        setAiLoading(false);
      }
    },
    [workspaceId],
  );

  function run(e: React.FormEvent) {
    e.preventDefault();
    doSearch(query);
  }

  // Honour an initial ?q= (e.g. handed off from the ⌘K palette's "Ask Aqli").
  // `query` is seeded from the param above; this only kicks off the fetch
  // (deferred so the state updates land outside the effect body).
  useEffect(() => {
    if (!initialQuery) return;
    const t = setTimeout(() => doSearch(initialQuery), 0);
    return () => clearTimeout(t);
  }, [initialQuery, doSearch]);

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Search" }]} />
      <div className="content" style={{ padding: "28px 40px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          {/* Search bar */}
          <form
            onSubmit={run}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              borderRadius: 10,
              height: 52,
              marginBottom: 14,
              boxShadow: "0 0 0 4px rgba(15,110,86,0.06)",
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}><IconSearch size={18} /></span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs by title and content…"
              style={{ flex: 1, border: 0, outline: 0, background: "transparent", fontFamily: "var(--font-sans)", fontSize: 16, color: "var(--text-primary)" }}
            />
            <button type="submit" disabled={busy} className="btn btn-primary" style={{ height: 36 }}>
              {busy ? "Searching…" : "Search"}
            </button>
          </form>

          <div className="fpills" style={{ marginBottom: 24 }}>
            <button className="fpill is-active" type="button">All Spaces</button>
            {searched && (
              <span style={{ marginLeft: 12, fontSize: 12, color: "var(--text-muted)" }}>
                {results.length} result{results.length === 1 ? "" : "s"} · {ms} ms
              </span>
            )}
          </div>

          {!searched && (
            <div style={{ border: "1px dashed var(--border-strong)", borderRadius: 12, padding: "56px 32px", textAlign: "center", color: "var(--text-muted)", fontSize: 13.5, background: "var(--bg-card)" }}>
              Search across every doc in this workspace — agents query the same index.
            </div>
          )}

          {searched && results.length === 0 && (
            <div style={{ border: "1px dashed var(--border-strong)", borderRadius: 12, padding: "48px 32px", textAlign: "center", color: "var(--text-muted)", fontSize: 13.5, background: "var(--bg-card)" }}>
              No results for &ldquo;{query}&rdquo;.
            </div>
          )}

          {searched && results.length > 0 && (
            <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                {results.map((r) => {
                  const [pre, match, post] = excerptParts(r.body_md, query);
                  const isAgent = r.author_type === "agent";
                  return (
                    <Link
                      key={r.id}
                      href={`${base}/docs/${r.id}`}
                      className={isAgent ? "agent-row" : ""}
                      style={{
                        padding: "16px 20px",
                        border: "1px solid var(--border)",
                        background: isAgent ? undefined : "var(--bg-card)",
                        borderRadius: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        textDecoration: "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>{r.title}</h4>
                        <span style={{ color: "var(--text-muted)" }}><IconArrowUpRight size={13} /></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                        <TypeBadge type={typeLabel(r.type)} />
                        <span style={{ color: "var(--text-muted)" }}>·</span>
                        <StatusBadge status={statusLabel(r.status)} />
                        {isAgent && (
                          <>
                            <span style={{ color: "var(--text-muted)" }}>·</span>
                            <span className="agent-chip" style={{ height: 20, fontSize: 11 }}><IconRobot size={11} />Agent</span>
                          </>
                        )}
                      </div>
                      {(pre || match || post) && (
                        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                          {pre}
                          {match && (
                            <mark style={{ background: "var(--review-bg)", color: "var(--review-text)", padding: "1px 3px", borderRadius: 3, fontWeight: 500 }}>{match}</mark>
                          )}
                          {post}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>

              <AiAnswerPanel query={query} results={results} base={base} aiAnswer={aiAnswer} aiLoading={aiLoading} workspaceId={workspaceId} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AiAnswerPanel({
  query,
  results,
  base,
  aiAnswer,
  aiLoading,
}: {
  query: string;
  results: Result[];
  base: string;
  aiAnswer: AiAnswer;
  aiLoading: boolean;
  workspaceId: string;
}) {
  return (
    <aside
      style={{
        width: 380,
        flex: "0 0 380px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "20px 22px",
        alignSelf: "flex-start",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--accent)" }}><IconSparkle size={16} /></span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Aqli Answer</span>
        {aiLoading && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>Thinking…</span>
        )}
        {!aiLoading && aiAnswer && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>Synthesised</span>
        )}
      </div>

      {aiLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[100, 85, 60].map((w, i) => (
            <div key={i} style={{ height: 14, borderRadius: 4, background: "var(--border)", width: `${w}%`, opacity: 0.6 }} />
          ))}
        </div>
      )}

      {!aiLoading && aiAnswer && (
        <>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
            {aiAnswer.answer}
          </p>
          {aiAnswer.sources.length > 0 && (
            <div>
              <div style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>
                Sources
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {aiAnswer.sources.slice(0, 4).map((s) => (
                  <Link key={s.doc_id} href={`${base}/docs/${s.doc_id}`} className="tag" style={{ background: "var(--accent-light)", borderColor: "rgba(15,110,86,0.18)", color: "var(--accent)", textDecoration: "none" }}>
                    {s.doc_title.length > 28 ? s.doc_title.slice(0, 28) + "…" : s.doc_title}
                    <IconArrowUpRight size={11} style={{ marginLeft: 4 }} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!aiLoading && !aiAnswer && (
        <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 16, lineHeight: 1.5, color: "var(--text-secondary)", letterSpacing: "-0.005em" }}>
          Found {results.length} doc{results.length === 1 ? "" : "s"} matching &ldquo;{query}&rdquo;.
          Ask a question to get a synthesised answer from approved docs.
        </p>
      )}

      <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
        Answers draw only from approved docs. The same index your agents query via the API.
      </div>
    </aside>
  );
}
