"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import {
  IconArrowUpRight,
  IconChat,
  IconCheck,
  IconWand,
  IconX,
} from "@/components/aqli/icons";
import { markdownToTiptap } from "@/lib/markdown/md-to-tiptap";
import { tiptapToMarkdown } from "@/lib/markdown/tiptap-to-md";
import type { CowriteMessage } from "@/components/editor/v2/types";

/**
 * The one floating affordance a surface is allowed.
 *
 * The editor and the viewer used to float a dark pill each *and* inherit the
 * workspace-wide "Ask Aqli" pill from the layout, so both screens ended up with
 * two of them fighting over the same corner. Co-write and Ask are now the two
 * modes of a single component: a surface mounts it once, with one mode, and
 * there is no arrangement of props that produces two pills.
 */
export type AssistantMode = "cowrite" | "ask";

type Source = { doc_id: string; doc_title: string; heading: string | null };
type AskTurn = { role: "user" | "aqli"; text: string; sources?: Source[] };

type CommonProps = {
  open: boolean;
  onToggle: (open: boolean) => void;
  workspaceId: string;
};

type CowriteProps = CommonProps & {
  mode: "cowrite";
  editor: Editor;
  docId: string;
  docTitle: string;
  base: string;
  prefill: string | null;
  onPrefillConsumed: () => void;
};

type AskProps = CommonProps & {
  mode: "ask";
  workspaceSlug: string;
  /** When set, questions are biased toward this doc and the pill says so. */
  docId?: string | null;
  docTitle?: string | null;
};

export type FloatingAssistantProps = CowriteProps | AskProps;

export default function FloatingAssistant(props: FloatingAssistantProps) {
  return props.mode === "cowrite" ? (
    <CowriteAssistant {...props} />
  ) : (
    <AskAssistant {...props} />
  );
}

// ── Shared shell ─────────────────────────────────────────────────────

function AssistantPill({
  label,
  kbd,
  icon,
  onClick,
}: {
  label: string;
  kbd: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="assistant-dock assistant-pill"
      aria-label={label}
    >
      <span className="assistant-orb">{icon}</span>
      <span>{label}</span>
      <kbd className="assistant-kbd">{kbd}</kbd>
    </button>
  );
}

function AssistantPanel({
  title,
  subtitle,
  icon,
  onClose,
  closeTitle,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClose: () => void;
  closeTitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="assistant-dock assistant-panel">
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg-base)",
          flex: "0 0 auto",
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "var(--accent)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </span>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
            {title}
          </span>
          <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{subtitle}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title={closeTitle}
          aria-label={closeTitle}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: 0,
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "inline-flex",
            padding: 4,
          }}
        >
          <IconX size={14} />
        </button>
      </div>
      {children}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ alignSelf: "flex-end", maxWidth: "82%" }}>
      <div
        style={{
          padding: "8px 12px",
          background: "var(--accent)",
          color: "#fff",
          borderRadius: "14px 14px 4px 14px",
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function ReplyBubble({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "92%" }}>
      <div
        style={{
          padding: "10px 12px",
          background: "var(--bg-base)",
          border: "1px solid var(--border)",
          borderRadius: "14px 14px 14px 4px",
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--text-primary)",
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SourceChips({
  label,
  sources,
  href,
}: {
  label: string;
  sources: Source[];
  href: (s: Source) => string;
}) {
  if (sources.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 8,
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        fontSize: 10.5,
        color: "var(--text-muted)",
        alignItems: "center",
      }}
    >
      <span style={{ marginRight: 2 }}>{label}</span>
      {sources.map((s) => (
        <Link
          key={`${s.doc_id}-${s.heading ?? ""}`}
          href={href(s)}
          style={{
            fontSize: 11,
            padding: "1px 6px",
            background: "var(--bg-sidebar)",
            borderRadius: 4,
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <IconArrowUpRight size={10} />
          {s.doc_title}
          {s.heading ? ` · ${s.heading}` : ""}
        </Link>
      ))}
    </div>
  );
}

const composerStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "var(--bg-base)",
  flex: "0 0 auto",
};

// ── Co-write ─────────────────────────────────────────────────────────

/** Strip the trailing "> Note: …" meta-comment before inserting a draft. */
function insertableMarkdown(md: string): string {
  return md
    .split("\n")
    .filter((line) => !/^>\s*Note:/i.test(line.trim()))
    .join("\n")
    .trim();
}

function CowriteAssistant({
  open,
  onToggle,
  editor,
  workspaceId,
  docId,
  docTitle,
  base,
  prefill,
  onPrefillConsumed,
}: CowriteProps) {
  const [messages, setMessages] = useState<CowriteMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && prefill) {
      const timer = window.setTimeout(() => {
        setInput(prefill);
        onPrefillConsumed();
        inputRef.current?.focus();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, prefill, onPrefillConsumed]);

  useEffect(() => {
    if (open) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [open, messages.length, busy]);

  const send = useCallback(
    async (history: CowriteMessage[]) => {
      setBusy(true);
      try {
        const res = await fetch("/api/ai/cowrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            doc_id: docId,
            title: docTitle,
            body_md: tiptapToMarkdown(editor.getJSON() as Record<string, unknown>),
            messages: history.map(({ role, content }) => ({ role, content })),
          }),
        });
        const data = await res.json();
        setMessages([
          ...history,
          {
            role: "assistant",
            content:
              typeof data.reply === "string" && data.reply
                ? data.reply
                : "Something went wrong — try again.",
            sources: data.sources ?? [],
          },
        ]);
      } catch {
        setMessages([
          ...history,
          { role: "assistant", content: "Something went wrong — try again." },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [editor, workspaceId, docId, docTitle],
  );

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || busy) return;
    const history: CowriteMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    void send(history);
  }, [input, busy, messages, send]);

  const regenerate = useCallback(() => {
    if (busy) return;
    const history = [...messages];
    if (history[history.length - 1]?.role === "assistant") history.pop();
    if (history.length === 0) return;
    setMessages(history);
    void send(history);
  }, [busy, messages, send]);

  const insert = useCallback(
    (md: string) => {
      const content = markdownToTiptap(insertableMarkdown(md)).content ?? [];
      if (content.length === 0) return;
      editor.chain().focus().insertContentAt(editor.state.selection.to, content).run();
    },
    [editor],
  );

  if (!open) {
    return (
      <AssistantPill
        label="Co-write"
        kbd="⌘J"
        icon={<IconWand size={12} />}
        onClick={() => onToggle(true)}
      />
    );
  }

  return (
    <AssistantPanel
      title="Co-write"
      subtitle="Drafts inline · you approve every change"
      icon={<IconWand size={12} />}
      onClose={() => onToggle(false)}
      closeTitle="Collapse (⌘J)"
    >
      <div
        ref={bodyRef}
        style={{
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minHeight: 120,
          overflowY: "auto",
          flex: 1,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: "92%",
              padding: "10px 12px",
              background: "var(--accent-light)",
              border: "1px solid var(--approved-border)",
              borderRadius: "14px 14px 14px 4px",
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--text-primary)",
            }}
          >
            I can draft sections, tighten prose, or cite approved docs from this
            workspace. Try <strong>&ldquo;Draft the rollout plan section.&rdquo;</strong>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <UserBubble key={i} text={m.content} />
          ) : (
            <ReplyBubble key={i}>
              {m.content}
              <SourceChips
                label="From:"
                sources={(m.sources ?? []) as Source[]}
                href={(s) => `${base}/docs/${s.doc_id}`}
              />
              <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                <button
                  className="btn btn-primary"
                  style={{ height: 24, fontSize: 11.5, padding: "0 10px" }}
                  onClick={() => insert(m.content)}
                >
                  <IconCheck size={10} /> Insert at cursor
                </button>
                {i === messages.length - 1 && (
                  <button
                    className="btn btn-ghost"
                    style={{ height: 24, fontSize: 11.5, padding: "0 8px", color: "var(--text-muted)" }}
                    onClick={regenerate}
                  >
                    Regenerate
                  </button>
                )}
              </div>
            </ReplyBubble>
          ),
        )}

        {busy && (
          <div style={{ alignSelf: "flex-start", fontSize: 12, color: "var(--text-muted)" }}>
            Co-write is thinking…
          </div>
        )}
      </div>

      <div style={composerStyle}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ask Co-write to draft, tighten, or cite…"
          style={{
            flex: 1,
            fontSize: 13,
            background: "transparent",
            border: 0,
            outline: "none",
            color: "var(--text-primary)",
            fontFamily: "var(--font-sans)",
          }}
        />
        <kbd
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-muted)",
            padding: "1px 5px",
            border: "1px solid var(--border)",
            borderRadius: 3,
          }}
        >
          ↵
        </kbd>
      </div>
    </AssistantPanel>
  );
}

// ── Ask ──────────────────────────────────────────────────────────────

function AskAssistant({
  open,
  onToggle,
  workspaceId,
  workspaceSlug,
  docId,
  docTitle,
}: AskProps) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [loading, setLoading] = useState(false);
  // *Which* doc the reader dismissed scoping for, rather than a boolean reset
  // when `docId` changes — storing the id means scoping re-enables on the next
  // doc without an effect that sets state during render.
  const [scopeOffDocId, setScopeOffDocId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading, open]);

  // "?" opens the panel, the way the pill advertises. Ignored while the caret
  // is in a field, so typing a question mark anywhere never triggers it.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
      )
        return;
      e.preventDefault();
      onToggle(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onToggle]);

  const scoped = Boolean(docId && docTitle && scopeOffDocId !== docId);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: scoped ? `In the context of the doc "${docTitle}": ${q}` : q,
          workspace_id: workspaceId,
        }),
      });
      const data = await res.json();
      setTurns((t) => [
        ...t,
        { role: "aqli", text: data.answer ?? "Unable to answer.", sources: data.sources ?? [] },
      ]);
    } catch {
      setTurns((t) => [...t, { role: "aqli", text: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <AssistantPill
        label={docId ? "Ask about this doc" : "Ask Aqli"}
        kbd="?"
        icon={<IconChat size={12} />}
        onClick={() => onToggle(true)}
      />
    );
  }

  return (
    <AssistantPanel
      title={docId ? "Ask about this doc" : "Ask Aqli"}
      subtitle="Answers cite approved docs"
      icon={<IconChat size={12} />}
      onClose={() => onToggle(false)}
      closeTitle="Close"
    >
      <div
        ref={bodyRef}
        style={{
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "auto",
          flex: 1,
        }}
      >
        {turns.length === 0 && !loading && (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            {scoped ? (
              <>
                Ask anything about <strong style={{ fontWeight: 500 }}>{docTitle}</strong> —
                what it decided, who owns it, what it leaves open. Answers are drawn
                from approved docs.
              </>
            ) : (
              <>
                Ask anything about this workspace&rsquo;s knowledge — e.g. &ldquo;how
                does our auth flow work?&rdquo; Answers are drawn from approved docs.
              </>
            )}
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <UserBubble key={i} text={t.text} />
          ) : (
            <ReplyBubble key={i}>
              {t.text}
              <SourceChips
                label="Cited:"
                sources={t.sources ?? []}
                href={(s) => `/w/${workspaceSlug}/docs/${s.doc_id}`}
              />
            </ReplyBubble>
          ),
        )}
        {loading && (
          <div style={{ alignSelf: "flex-start", fontSize: 12.5, color: "var(--text-muted)" }}>
            Searching approved docs…
          </div>
        )}
      </div>

      {scoped && (
        <div
          style={{
            padding: "6px 12px 0",
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--bg-base)",
            borderTop: "1px solid var(--border)",
            flex: "0 0 auto",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10.5,
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--accent-light)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              maxWidth: "100%",
              minWidth: 0,
            }}
          >
            <span style={{ whiteSpace: "nowrap" }}>Asking about:</span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontWeight: 500,
              }}
            >
              {docTitle}
            </span>
            <button
              type="button"
              onClick={() => setScopeOffDocId(docId ?? null)}
              title="Ask the whole workspace instead"
              aria-label="Ask the whole workspace instead"
              style={{
                background: "transparent",
                border: 0,
                padding: 0,
                cursor: "pointer",
                color: "var(--text-muted)",
                display: "inline-flex",
              }}
            >
              <IconX size={10} />
            </button>
          </span>
        </div>
      )}

      <div style={{ ...composerStyle, borderTop: scoped ? 0 : "1px solid var(--border)" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(input)}
          placeholder={turns.length ? "Ask a follow-up…" : "Ask a question…"}
          autoFocus
          style={{
            flex: 1,
            height: 30,
            padding: "0 10px",
            fontSize: 13,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            outline: "none",
            fontFamily: "var(--font-sans)",
          }}
        />
        <button
          onClick={() => ask(input)}
          disabled={loading || !input.trim()}
          className="btn btn-primary"
          style={{ height: 30, padding: "0 12px", fontSize: 12.5 }}
        >
          Ask
        </button>
      </div>
    </AssistantPanel>
  );
}
