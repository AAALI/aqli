/**
 * The markdown-it side of the pipeline, shared by the ProseMirror parser
 * (`parser.ts`) and the server-side HTML renderer (`render-html.ts`).
 *
 * Three things markdown-it does not model the way the Aqli schema needs are
 * handled by rewriting the token stream before either consumer sees it:
 *
 *   1. Table cells emit inline content directly; Tiptap cells hold blocks.
 *   2. GFM task lists are ordinary bullet lists with `[ ]` text in markdown-it.
 *   3. GFM alerts (`> [!NOTE]`) are ordinary blockquotes.
 *
 * Doing it at the token level keeps a single parse pass and means both
 * consumers agree on what a document contains. This module imports nothing
 * from Tiptap on purpose: the renderer runs on the server, where the editor
 * schema and ProseMirror have no business being.
 */
import MarkdownIt from "markdown-it";
// Same module `prosemirror-markdown` types its tokens against, so the two agree.
import Token from "markdown-it/lib/token.mjs";
import { CALLOUT_KINDS, type CalloutKind } from "./callouts";

/** `default` rather than `commonmark`: it turns on GFM tables and strikethrough. */
export const tokenizer = MarkdownIt("default", { html: false, linkify: false });

const CALLOUT_RE = new RegExp(`^\\[!(${CALLOUT_KINDS.join("|")})\\]\\s*$`, "i");
// GFM wants whitespace after the checkbox, but an empty task item is a normal
// editor state and serializes to a bare `- [ ]`. Accepting end-of-string too is
// what lets an unchecked, empty item survive a round trip.
export const TASK_RE = /^\[([ xX])\](?:\s+|$)/;

export type TokenMeta = { callout?: CalloutKind; checked?: boolean };

export function meta(token: Token): TokenMeta {
  return (token.meta ?? {}) as TokenMeta;
}

/** A synthetic block token, for the wrappers markdown-it does not emit. */
function blockToken(type: string, tag: string, nesting: 1 | -1): Token {
  const token = new Token(type, tag, nesting);
  token.block = true;
  return token;
}

/** Index of the matching close token for the open token at `start`. */
function matchingClose(tokens: Token[], start: number): number {
  let depth = 0;
  for (let i = start; i < tokens.length; i++) {
    if (tokens[i].type === tokens[start].type) depth++;
    else if (tokens[i].type === tokens[start].type.replace(/_open$/, "_close")) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return tokens.length - 1;
}

/**
 * Tiptap table cells have `block+` content, so the bare `inline` token that
 * markdown-it puts inside `th`/`td` has to be wrapped in a paragraph. The
 * `thead`/`tbody` grouping tokens have no counterpart in the schema and are
 * dropped.
 */
function normaliseTables(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (
      token.type === "thead_open" ||
      token.type === "thead_close" ||
      token.type === "tbody_open" ||
      token.type === "tbody_close"
    ) {
      continue;
    }

    out.push(token);

    if (token.type === "th_open" || token.type === "td_open") {
      const closeType = token.type === "th_open" ? "th_close" : "td_close";
      out.push(blockToken("paragraph_open", "p", 1));

      // Copy the cell body across, then close the paragraph before the cell.
      let j = i + 1;
      for (; j < tokens.length && tokens[j].type !== closeType; j++) {
        out.push(tokens[j]);
      }
      out.push(blockToken("paragraph_close", "p", -1));
      i = j - 1;
    }
  }
  return out;
}

/**
 * A bullet list becomes a task list only when every item carries a checkbox.
 * Tiptap's `taskList` accepts `taskItem` children exclusively, so a mixed list
 * has to stay a plain bullet list — its `[ ]` text is escaped on the way out,
 * which is what keeps that case a fixed point.
 */
function normaliseTaskLists(tokens: Token[]): Token[] {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "bullet_list_open") continue;

    const end = matchingClose(tokens, i);
    const itemStarts: number[] = [];
    let depth = 0;
    for (let j = i + 1; j < end; j++) {
      const type = tokens[j].type;
      if (type === "bullet_list_open" || type === "ordered_list_open") depth++;
      else if (type === "bullet_list_close" || type === "ordered_list_close") depth--;
      else if (type === "list_item_open" && depth === 0) itemStarts.push(j);
    }
    if (itemStarts.length === 0) continue;

    // The first inline token of each item, which is where a checkbox would be.
    const firstInline = itemStarts.map((start) => {
      const stop = matchingClose(tokens, start);
      for (let j = start + 1; j < stop; j++) {
        if (tokens[j].type === "inline") return j;
      }
      return -1;
    });

    const checks = firstInline.map((idx) => {
      if (idx < 0) return null;
      return TASK_RE.exec(tokens[idx].content);
    });
    if (!checks.every((c) => c !== null)) continue;

    // Resolve every close index before rewriting any type — `matchingClose`
    // searches by token type, so retyping as it goes would break the search.
    const itemEnds = itemStarts.map((start) => matchingClose(tokens, start));

    tokens[i].type = "task_list_open";
    tokens[end].type = "task_list_close";
    itemStarts.forEach((start, n) => {
      const match = checks[n];
      if (!match) return;
      tokens[start].type = "task_item_open";
      tokens[start].meta = {
        ...meta(tokens[start]),
        checked: match[1].toLowerCase() === "x",
      };
      tokens[itemEnds[n]].type = "task_item_close";

      // Strip the checkbox from both the inline token and its first child, or
      // the marker text reappears in the document body.
      const inline = tokens[firstInline[n]];
      inline.content = inline.content.replace(TASK_RE, "");
      const child = inline.children?.[0];
      if (child && child.type === "text") {
        child.content = child.content.replace(TASK_RE, "");
      }
    });
  }
  return tokens;
}

/**
 * `> [!NOTE]` on the first line of a blockquote becomes a `callout` attribute
 * on that blockquote, and the marker line itself is removed.
 */
function normaliseCallouts(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    out.push(token);
    if (token.type !== "blockquote_open") continue;

    if (tokens[i + 1]?.type !== "paragraph_open") continue;
    const inline = tokens[i + 2];
    if (inline?.type !== "inline") continue;

    const first = inline.children?.[0];
    if (!first || first.type !== "text") continue;
    const match = CALLOUT_RE.exec(first.content.trim());
    if (!match) continue;

    token.meta = {
      ...meta(token),
      callout: match[1].toUpperCase() as CalloutKind,
    };

    // Drop the marker, and the soft break that separated it from the body.
    const children = inline.children ?? [];
    let drop = 1;
    if (children[1]?.type === "softbreak") drop = 2;
    inline.children = children.slice(drop);
    inline.content = inline.content.replace(/^[^\n]*\n?/, "");

    // A marker-only paragraph leaves nothing behind; skip its three tokens.
    if (inline.children.length === 0) {
      i += 3;
    }
  }
  return out;
}

/** The three rewrites, in the order the consumers rely on. */
export function normaliseTokens(tokens: Token[]): Token[] {
  return normaliseCallouts(normaliseTaskLists(normaliseTables(tokens)));
}

/**
 * The language of a fenced block, as the parser records it. The info string is
 * written straight after the opening fence, so a backtick or tilde in it would
 * close or corrupt that fence; they are stripped rather than trusted.
 */
export function fenceLanguage(token: Token): string | null {
  return token.info.trim().split(/\s+/)[0]?.replace(/[`~]/g, "") || null;
}
