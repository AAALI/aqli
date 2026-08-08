"use client";

import { useId, useMemo, useRef, useState } from "react";
import { avatarColor } from "@/lib/utils";
import { formatMention } from "@/lib/mentions";

export type MentionCandidate = {
  user_id: string;
  /** Unique display label — see `withUniqueLabels`. */
  label: string;
  /** Shown under the label to tell two people with the same name apart. */
  hint: string;
};

/**
 * Give every member a label that is unique within the workspace.
 *
 * The composer works by remembering which labels the author picked and
 * swapping them for `@[Label](user:id)` tokens on submit, which only holds up
 * if a label points at exactly one person. Two members called "Alex Chen"
 * would otherwise make the second insert silently address the first, so the
 * duplicates get their email local part appended and stop colliding.
 */
export function withUniqueLabels(
  members: { user_id: string; name: string; email: string }[],
): MentionCandidate[] {
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.name, (counts.get(m.name) ?? 0) + 1);

  return members.map((m) => {
    const local = m.email.split("@")[0];
    const duplicated = (counts.get(m.name) ?? 0) > 1;
    return {
      user_id: m.user_id,
      label: duplicated ? `${m.name} (${local})` : m.name,
      hint: m.email,
    };
  });
}

/** The `@query` immediately before the caret, if the caret is in one. */
function activeQuery(value: string, caret: number): { from: number; query: string } | null {
  const upto = value.slice(0, caret);
  // An `@` that starts a word, followed by no more than a short name's worth
  // of non-newline text. Requiring the word boundary keeps email addresses
  // from opening the menu on every keystroke.
  const match = /(?:^|[\s([{>])@([^\s@]{0,40})$/.exec(upto);
  if (!match) return null;
  return { from: caret - match[1].length - 1, query: match[1] };
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turn the composer's display text into a storable body.
 *
 * Exported for the test: only labels the author actually chose from the menu
 * become mentions. Typing `@ada` by hand stays literal text, which is the
 * predictable behaviour — the alternative is guessing who was meant.
 */
export function resolveMentions(
  text: string,
  chosen: Map<string, string>,
): string {
  // Longest label first, so "Ada Lovelace (ada.b)" is consumed before the
  // "Ada Lovelace" that is a prefix of it.
  const labels = Array.from(chosen.keys()).sort((a, b) => b.length - a.length);
  let out = text;
  for (const label of labels) {
    const userId = chosen.get(label);
    if (!userId) continue;
    out = out.replace(
      new RegExp(`@${escapeRegExp(label)}`, "g"),
      () => formatMention(userId, label),
    );
  }
  return out;
}

/**
 * A plain textarea with an @mention menu.
 *
 * Deliberately not a Tiptap instance. A comment is not an Aqli document: the
 * editor's schema is the allowlist that `body_md` has to round-trip, and
 * mounting it here would either drag comment bodies into that contract or
 * fork the schema — the two things `lib/markdown/schema.ts` exists to prevent.
 *
 * The author sees `@Ada Lovelace` while typing; the `@[Ada Lovelace](user:…)`
 * token is produced by `resolveMentions` on submit. Keeping the uuid out of
 * the visible text is the whole reason for the label bookkeeping.
 */
export default function MentionTextarea({
  value,
  onChange,
  candidates,
  onMention,
  onSubmit,
  placeholder,
  disabled,
  minHeight = 78,
}: {
  value: string;
  onChange: (next: string) => void;
  candidates: MentionCandidate[];
  /**
   * Fired when the author picks someone from the menu. The parent keeps the
   * label → user id map that `resolveMentions` needs at submit time; this
   * component owns no state that outlives a keystroke.
   */
  onMention?: (candidate: MentionCandidate) => void;
  /** Called on ⌘/Ctrl+Enter. */
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Stable across renders, so `aria-activedescendant` can point at an option
  // by id — the only way a screen reader learns which row is highlighted when
  // focus never leaves the textarea.
  const menuId = useId();
  const optionId = (i: number) => `${menuId}-option-${i}`;
  const [query, setQueryState] = useState<{ from: number; query: string } | null>(null);
  const [highlighted, setHighlighted] = useState(0);

  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.query.toLowerCase();
    return candidates
      .filter((c) => !q || c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, candidates]);

  /**
   * Moving the query moves the selection back to the top. Done here rather than
   * in an effect watching `query`: the reset belongs to the event that changed
   * the query, and an effect would re-render a second time to do the same job.
   *
   * A query equal to the current one is not a move. `activeQuery` builds a
   * fresh object every call, so without this comparison any event that merely
   * re-derives the same query — a caret keyup, a click landing where the caret
   * already was — would count as a change and throw away the highlight the
   * author had arrowed to.
   */
  function setQuery(next: { from: number; query: string } | null) {
    const same =
      next?.from === query?.from && next?.query === query?.query;
    if (same) return;
    setQueryState(next);
    setHighlighted(0);
  }

  const open = query !== null && matches.length > 0;
  // The filter can shrink under a stale index between renders.
  const selected = Math.min(highlighted, Math.max(matches.length - 1, 0));

  function sync(el: HTMLTextAreaElement) {
    setQuery(activeQuery(el.value, el.selectionStart ?? el.value.length));
  }

  function insert(candidate: MentionCandidate) {
    const el = ref.current;
    if (!el || !query) return;
    const caret = el.selectionStart ?? value.length;
    const next = `${value.slice(0, query.from)}@${candidate.label} ${value.slice(caret)}`;
    onChange(next);
    onMention?.(candidate);
    setQuery(null);

    // Put the caret after the inserted name rather than leaving it where the
    // shorter query ended.
    const at = query.from + candidate.label.length + 2;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at, at);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((selected + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((selected - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insert(matches[selected]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={ref}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open ? optionId(selected) : undefined}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          sync(e.target);
        }}
        onClick={(e) => sync(e.currentTarget)}
        onKeyUp={(e) => {
          // While the menu is open, up and down belong to it — `onKeyDown`
          // already consumed them and the caret has not moved.
          if (open && (e.key === "ArrowUp" || e.key === "ArrowDown")) return;
          // Otherwise arrows move the caret out of (or into) a query without
          // changing the text, so the menu has to follow the caret too.
          if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
            sync(e.currentTarget);
          }
        }}
        onBlur={() => {
          // Let a click on the menu land before it unmounts.
          setTimeout(() => setQuery(null), 120);
        }}
        onKeyDown={onKeyDown}
        style={{
          width: "100%",
          minHeight,
          padding: "10px 12px",
          background: "var(--bg-base)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontSize: 13.5,
          color: "var(--text-primary)",
          lineHeight: 1.55,
          fontFamily: "var(--font-sans)",
          outline: "none",
          resize: "vertical",
        }}
      />

      {open && (
        <div
          id={menuId}
          role="listbox"
          aria-label="Mention a teammate"
          style={{
            position: "absolute",
            left: 8,
            bottom: "calc(100% - 4px)",
            zIndex: 30,
            minWidth: 240,
            maxWidth: 320,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
            padding: 4,
          }}
        >
          {matches.map((c, i) => (
            <button
              key={c.user_id}
              id={optionId(i)}
              role="option"
              aria-selected={i === selected}
              type="button"
              onMouseEnter={() => setHighlighted(i)}
              onMouseDown={(e) => {
                // mousedown, not click: blur would close the menu first.
                e.preventDefault();
                insert(c);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                textAlign: "left",
                border: 0,
                cursor: "pointer",
                padding: "6px 8px",
                borderRadius: 5,
                background: i === selected ? "var(--accent-light)" : "transparent",
                fontFamily: "var(--font-sans)",
              }}
            >
              <span
                className="avatar avatar-sm"
                style={{ background: avatarColor(c.label) }}
              >
                {c.label.charAt(0).toUpperCase()}
              </span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
