/**
 * Markdown -> Tiptap/ProseMirror document.
 *
 * Built on `prosemirror-markdown`'s `MarkdownParser` with an explicit spec per
 * token, mirroring `serializer.ts`. Three things markdown-it does not model the
 * way the Aqli schema needs are handled by rewriting the token stream before it
 * reaches the parser:
 *
 *   1. Table cells emit inline content directly; Tiptap cells hold blocks.
 *   2. GFM task lists are ordinary bullet lists with `[ ]` text in markdown-it.
 *   3. GFM alerts (`> [!NOTE]`) are ordinary blockquotes.
 *
 * Doing this at the token level keeps a single parse pass and means the node
 * specs stay declarative.
 */
import MarkdownIt from "markdown-it";
// Same module `prosemirror-markdown` types its tokens against, so the two agree.
import Token from "markdown-it/lib/token.mjs";
import { MarkdownParser, type ParseSpec } from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";
import { CALLOUT_KINDS, aqliSchema, type CalloutKind } from "./schema";

/** `default` rather than `commonmark`: it turns on GFM tables and strikethrough. */
const tokenizer = MarkdownIt("default", { html: false, linkify: false });

const CALLOUT_RE = new RegExp(`^\\[!(${CALLOUT_KINDS.join("|")})\\]\\s*$`, "i");
// GFM wants whitespace after the checkbox, but an empty task item is a normal
// editor state and serializes to a bare `- [ ]`. Accepting end-of-string too is
// what lets an unchecked, empty item survive a round trip.
const TASK_RE = /^\[([ xX])\](?:\s+|$)/;

type TokenMeta = { callout?: CalloutKind; checked?: boolean };

function meta(token: Token): TokenMeta {
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

const tokens: Record<string, ParseSpec> = {
  blockquote: {
    block: "blockquote",
    getAttrs: (token) => ({ callout: meta(token).callout ?? null }),
  },
  paragraph: { block: "paragraph" },
  list_item: { block: "listItem" },
  bullet_list: { block: "bulletList" },
  ordered_list: {
    block: "orderedList",
    getAttrs: (token) => ({ start: Number(token.attrGet("start")) || 1 }),
  },
  task_list: { block: "taskList" },
  task_item: {
    block: "taskItem",
    getAttrs: (token) => ({ checked: meta(token).checked === true }),
  },
  heading: {
    block: "heading",
    // The allowlist stops at h3; deeper headings normalise down to it.
    getAttrs: (token) => ({
      level: Math.min(3, Number(token.tag.slice(1)) || 1),
    }),
  },
  code_block: { block: "codeBlock", noCloseToken: true },
  fence: {
    block: "codeBlock",
    // The info string is written straight after the opening fence, so a
    // backtick or tilde in it would close or corrupt that fence. A tilde-fenced
    // block can carry them (` ~~~~ `(` `), so they are stripped rather than
    // trusted.
    getAttrs: (token) => ({
      language: token.info.trim().split(/\s+/)[0]?.replace(/[`~]/g, "") || null,
    }),
    noCloseToken: true,
  },
  hr: { node: "horizontalRule" },
  image: {
    node: "image",
    getAttrs: (token) => ({
      src: token.attrGet("src") ?? "",
      title: token.attrGet("title") || null,
      alt: token.children?.[0]?.content || null,
    }),
  },
  hardbreak: { node: "hardBreak" },
  em: { mark: "italic" },
  strong: { mark: "bold" },
  s: { mark: "strike" },
  link: {
    mark: "link",
    getAttrs: (token) => ({
      href: token.attrGet("href") ?? "",
      title: token.attrGet("title") || null,
    }),
  },
  code_inline: { mark: "code", noCloseToken: true },
  table: { block: "table" },
  tr: { block: "tableRow" },
  th: { block: "tableHeader" },
  td: { block: "tableCell" },
};

/**
 * markdown-it, plus the token rewrites above. `MarkdownParser` only needs
 * something with a `parse` method, so this stands in for the tokenizer.
 */
type TokenizerEnv = Parameters<typeof tokenizer.parse>[1];

const aqliTokenizer = Object.create(tokenizer) as typeof tokenizer;
aqliTokenizer.parse = (src: string, env: TokenizerEnv): Token[] => {
  const raw = tokenizer.parse(src, env);
  return normaliseCallouts(normaliseTaskLists(normaliseTables(raw)));
};

export const aqliMarkdownParser = new MarkdownParser(
  aqliSchema,
  aqliTokenizer,
  tokens,
);

type JSONNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

const ITEM_TYPES = new Set(["listItem", "taskItem"]);
const LIST_TYPES = new Set(["bulletList", "orderedList", "taskList"]);

/** A list item holding nothing but an empty paragraph. */
function isEmptyItem(node: JSONNode): boolean {
  if (!ITEM_TYPES.has(node.type)) return false;
  const content = node.content ?? [];
  return (
    content.length === 0 ||
    (content.length === 1 &&
      content[0].type === "paragraph" &&
      (content[0].content ?? []).length === 0)
  );
}

/**
 * Strip whitespace that markdown cannot carry across a parse.
 *
 * markdown-it discards leading and trailing whitespace in a textblock, so a
 * document that holds it would serialize to markdown that parses back
 * differently — the exact instability the fixed-point test exists to catch. It
 * shows up whenever an element with no content is dropped, e.g. the empty link
 * in `[](url) text`, which leaves a stranded leading space.
 *
 * Only unmarked text is trimmed: whitespace inside a code span is significant
 * and markdown-it preserves it.
 */
/** Emphasis marks whose delimiters cannot sit next to whitespace. */
const EXPELLABLE_MARKS = new Set(["bold", "italic", "strike"]);

function marksEqual(a: JSONNode["marks"], b: JSONNode["marks"]): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeAdjacentText(children: JSONNode[]): JSONNode[] {
  const out: JSONNode[] = [];
  for (const child of children) {
    const previous = out[out.length - 1];
    if (
      previous &&
      previous.type === "text" &&
      child.type === "text" &&
      marksEqual(previous.marks, child.marks)
    ) {
      out[out.length - 1] = { ...previous, text: (previous.text ?? "") + (child.text ?? "") };
    } else {
      out.push(child);
    }
  }
  return out;
}

/**
 * Move whitespace out of emphasis runs.
 *
 * CommonMark will not close emphasis on a delimiter preceded by whitespace, so
 * `*text *` is not emphasis at all — it is three literal characters. A mark run
 * that ends in a space therefore serializes to something that parses back
 * differently. `prosemirror-markdown` has `expelEnclosingWhitespace` for this,
 * but it only fires when the mark run ends at the text node, and a mark
 * continuing across an inline boundary (emphasis spanning into a link) slips
 * past it. Normalising the document instead makes it unconditional.
 *
 * Text carrying a `code` mark is left alone: whitespace inside a code span is
 * content, and markdown preserves it.
 */
function expelMarkWhitespace(children: JSONNode[]): JSONNode[] {
  const out: JSONNode[] = [];
  for (const child of children) {
    const marks = child.marks ?? [];
    const shouldExpel =
      child.type === "text" &&
      typeof child.text === "string" &&
      marks.some((mark) => EXPELLABLE_MARKS.has(mark.type)) &&
      !marks.some((mark) => mark.type === "code");

    if (!shouldExpel) {
      out.push(child);
      continue;
    }

    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(child.text as string);
    if (!match) {
      out.push(child);
      continue;
    }
    const [, leading, core, trailing] = match;
    if (leading) out.push({ type: "text", text: leading });
    if (core) out.push({ ...child, text: core });
    if (trailing) out.push({ type: "text", text: trailing });
    if (!leading && !core && !trailing) out.push(child);
  }
  return mergeAdjacentText(out);
}

function trimTextblock(children: JSONNode[]): JSONNode[] {
  const out = children.slice();
  const unmarked = (n: JSONNode | undefined) =>
    n !== undefined && n.type === "text" && (n.marks ?? []).length === 0;

  while (out.length > 0 && unmarked(out[0])) {
    const trimmed = (out[0].text ?? "").replace(/^\s+/, "");
    if (trimmed === "") out.shift();
    else {
      out[0] = { ...out[0], text: trimmed };
      break;
    }
  }
  while (out.length > 0 && unmarked(out[out.length - 1])) {
    const last = out.length - 1;
    const trimmed = (out[last].text ?? "").replace(/\s+$/, "");
    if (trimmed === "") out.pop();
    else {
      out[last] = { ...out[last], text: trimmed };
      break;
    }
  }
  return out;
}

/**
 * Normalise the parsed document into the subset that markdown can express.
 *
 * The one lossy rule here is dropping a thematic break nested in a list item.
 * `- ****` parses to an empty paragraph followed by a horizontal rule inside
 * the item, and there is no markdown spelling for that: indenting `---` under a
 * list marker reads as a top-level break on the way back in, so the document
 * would never settle. Tiptap's `listItem` content is `paragraph block*`, which
 * permits the shape the editor can never usefully produce. It is recorded in
 * the fidelity report rather than hidden.
 */
function normalizeJSON(node: JSONNode, parentType: string | null): JSONNode[] {
  if (node.type === "horizontalRule" && parentType !== null && ITEM_TYPES.has(parentType)) {
    return [];
  }

  if (!node.content) return [node];

  let children = node.content.flatMap((child) => normalizeJSON(child, node.type));

  // Code is verbatim. A code block is a textblock too, but its whitespace is
  // content: trimming it strips the indentation off the first line of every
  // fence and the trailing newlines off the end of all of them.
  const nodeType = aqliSchema.nodes[node.type];
  if (nodeType?.isTextblock && !nodeType.spec.code) {
    children = trimTextblock(expelMarkWhitespace(children));
  }

  // An empty paragraph has no markdown spelling — a blank line just separates
  // blocks — so one sitting beside other content disappears on the way back in.
  // Drop it here so the document already matches what markdown can say.
  // List items are exempt: their content is `paragraph block*`, so the leading
  // paragraph is structural, and the serializer skips writing it instead.
  if (children.length > 1 && !ITEM_TYPES.has(node.type)) {
    const kept = children.filter(
      (child) => !(child.type === "paragraph" && (child.content ?? []).length === 0),
    );
    if (kept.length > 0) children = kept;
  }

  // An item with nothing in it serializes to a bare marker, and a bare marker
  // on its own line is absorbed as literal text by the next parse rather than
  // coming back as an item. It only arises when everything inside was dropped —
  // an empty link, say — so there is no content to preserve. A list left with
  // no items goes too.
  if (LIST_TYPES.has(node.type)) {
    children = children.filter((child) => !isEmptyItem(child));
    if (children.length === 0) return [];
  }

  // Dropping content can empty a container whose schema demands children — a
  // blockquote holding nothing but a discarded list, say. Put an empty
  // paragraph back so the document stays valid.
  if (children.length === 0 && !aqliSchema.nodes[node.type]?.contentMatch.validEnd) {
    children = [{ type: "paragraph" }];
  }

  return [{ ...node, content: children }];
}

/** Parse markdown into a ProseMirror document in the Aqli schema. */
export function parseMarkdown(markdown: string): PMNode {
  const doc = aqliMarkdownParser.parse(markdown ?? "");
  const [normalized] = normalizeJSON(doc.toJSON() as JSONNode, null);

  // `doc` content is `block+`, and normalization can empty a document whose
  // only content was droppable — keep one empty paragraph so it stays valid.
  if (!normalized || (normalized.content ?? []).length === 0) {
    return aqliSchema.nodeFromJSON({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  }
  return aqliSchema.nodeFromJSON(normalized);
}
