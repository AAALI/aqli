"use client";

import { useState } from "react";
import { IconSparkle, IconArrowUpRight, IconChevDown, IconChevRight } from "@/components/aqli/icons";

type Source = {
  doc_id: string;
  doc_title: string;
  heading: string | null;
  source_url: string;
  score: number;
};

export default function AskQuestion({ workspaceId }: { workspaceId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);
    setSources([]);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, workspace_id: workspaceId }),
      });
      const data = await res.json();
      setAnswer(data.answer ?? "Unable to generate answer.");
      setSources(data.sources ?? []);
    } catch {
      setAnswer("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

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
        <span style={{ color: "var(--accent)", display: "flex" }}><IconSparkle size={12} /></span>
        <span>Ask Aqli</span>
        <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
          {open ? <IconChevDown size={13} /> : <IconChevRight size={13} />}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="Ask about your docs…"
              style={{
                flex: 1, height: 30, padding: "0 10px", fontSize: 13,
                background: "var(--bg-base)", border: "1px solid var(--border)",
                borderRadius: 6, color: "var(--text-primary)", outline: "none",
                fontFamily: "var(--font-sans)",
              }}
            />
            <button
              onClick={ask}
              disabled={loading || !question.trim()}
              className="btn btn-primary"
              style={{ height: 30, padding: "0 12px", fontSize: 12.5 }}
            >
              {loading ? "…" : "Ask"}
            </button>
          </div>

          {answer && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {answer}
              </p>

              {sources.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
                    Sources
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {sources.map((s) => (
                      <a
                        key={`${s.doc_id}-${s.heading ?? ""}`}
                        href={s.source_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--accent)", textDecoration: "none" }}
                      >
                        <IconArrowUpRight size={12} />
                        <span>{s.doc_title}{s.heading ? ` — ${s.heading}` : ""}</span>
                      </a>
                    ))}
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--text-muted)" }}>
                    Answer from approved docs only.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
