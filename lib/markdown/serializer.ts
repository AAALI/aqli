/**
 * Tiptap/ProseMirror document -> markdown.
 *
 * Every node and mark in `aqliSchema` gets an explicit serializer here. This is
 * deliberately not a convenience wrapper: after the step-6 flip a node the
 * serializer does not understand is content the user loses, so the mapping is
 * written out one entry at a time and checked for completeness at import time.
 */
import {
  MarkdownSerializer,
  type MarkdownSerializerState,
} from "prosemirror-markdown";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import { aqliSchema, isCalloutKind } from "./schema";

type NodeSerializer = (
  state: MarkdownSerializerState,
  node: PMNode,
  parent: PMNode,
  index: number,
) => void;

function attrString(node: PMNode, key: string): string | null {
  const value = node.attrs[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * A fence long enough to survive whatever backticks the code itself contains.
 * Without this, a code block holding markdown examples terminates early and the
 * rest of the document is reinterpreted as prose.
 */
function fenceFor(text: string): string {
  const runs = text.match(/`{3,}/g);
  if (!runs) return "```";
  const longest = runs.reduce((a, b) => (b.length > a.length ? b : a));
  return "`".repeat(longest.length + 1);
}

/**
 * Render one table cell to a single line.
 *
 * GFM pipe tables are strictly single-line and pipe-delimited, so a cell's
 * block structure is flattened and any literal pipe escaped. A cell holding
 * more than one paragraph cannot survive this — see the fidelity report.
 */
function renderCell(cell: PMNode): string {
  const inner = aqliMarkdownSerializer.serialize(cell, { tightLists: true }).trim();
  return inner.replace(/\n+/g, " ").replace(/\|/g, "\\|");
}

/** Lists that markdown would run together if they used the same marker. */
const BULLET_FAMILY = new Set(["bulletList", "taskList"]);
const ORDERED_FAMILY = new Set(["orderedList"]);

/** CommonMark's three bullet characters. Having a third is what makes the
 *  "differ from my parent and from my previous sibling" constraint solvable. */
const BULLET_MARKERS = ["-", "*", "+"] as const;

/** Marker of the list currently being rendered, so a nested list can avoid it. */
let enclosingBullet: string | null = null;

/** How many same-family lists immediately precede this one. */
function consecutiveSiblings(
  parent: PMNode,
  index: number,
  family: Set<string>,
): number {
  let count = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (!family.has(parent.child(i).type.name)) break;
    count++;
  }
  return count;
}

/**
 * Choose a bullet that keeps this list distinct from its neighbours.
 *
 * Two constraints, both of which corrupt the document when violated. Sibling
 * lists sharing a bullet merge into one on re-read — markdown has no blank line
 * long enough to separate them, and CommonMark's remedy is that changing the
 * bullet character starts a new list. And a nested list sharing its parent's
 * bullet can produce `- - -`, which is a thematic break, not three lists.
 *
 * Excluding the parent's marker leaves two candidates, and alternating between
 * those by sibling position satisfies both at once.
 */
function bulletMarker(parent: PMNode, index: number): string {
  const candidates = BULLET_MARKERS.filter((marker) => marker !== enclosingBullet);
  const position = consecutiveSiblings(parent, index, BULLET_FAMILY) % candidates.length;
  return candidates[position];
}

/** Render a list, recording its marker so nested lists pick a different one. */
function renderBulletList(
  state: MarkdownSerializerState,
  node: PMNode,
  marker: string,
): void {
  const previous = enclosingBullet;
  enclosingBullet = marker;
  try {
    state.renderList(node, "  ", () => `${marker} `);
  } finally {
    enclosingBullet = previous;
  }
}

/**
 * `*` or `_` for italic.
 *
 * An italic run that abuts a bold delimiter produces `***`, and a paragraph
 * alternating bold with bold-plus-italic emits several bare `*` runs that
 * CommonMark then pairs up differently from how they were written. Switching
 * that run to `_` removes the ambiguity, because `_` and `*` never combine into
 * one delimiter run. `*` stays the default elsewhere: `_` is not recognised
 * inside a word, so it cannot be used unconditionally.
 *
 * The decision is made over the whole contiguous italic run, so the opening and
 * closing delimiters always agree no matter which end asks.
 */
function italicDelimiter(parent: PMNode, index: number): string {
  const has = (i: number, mark: string) =>
    i >= 0 &&
    i < parent.childCount &&
    parent.child(i).marks.some((m) => m.type.name === mark);

  if (!has(index, "italic")) return "*";

  let start = index;
  while (has(start - 1, "italic")) start--;
  let end = index;
  while (has(end + 1, "italic")) end++;

  for (let i = start; i <= end; i++) {
    if (has(i, "bold")) return "_";
  }
  return "*";
}

/**
 * Render a list item's blocks, skipping an empty leading paragraph.
 *
 * `listItem` content is `paragraph block*`, so ProseMirror's `createAndFill`
 * inserts an empty paragraph whenever an item starts with something else — a
 * blockquote, a nested list, a code fence. Writing that paragraph out puts a
 * blank line straight after the list marker, which detaches everything below it
 * from the item on the way back in (`- ` + blank + `  > q` reads as a top-level
 * quote). Skipping it emits `- > q`, which parses back to the identical
 * document, empty paragraph and all.
 */
function renderItemContent(state: MarkdownSerializerState, node: PMNode): void {
  const first = node.firstChild;
  const skipFirst =
    node.childCount > 1 &&
    first !== null &&
    first.type.name === "paragraph" &&
    first.content.size === 0;

  node.forEach((child, _offset, index) => {
    if (skipFirst && index === 0) return;
    state.render(child, node, index);
  });
}

const nodes: Record<string, NodeSerializer> = {
  text(state, node, parent, index) {
    const text = node.text ?? "";

    // A block marker leading a line turns the text into that block on re-read.
    //
    // The default escaping handles a marker only when it is the very first
    // character of a block: it misses one preceded by whitespace, and it misses
    // every line after a hard break. Both occur in real documents — a paragraph
    // beginning `"  - "` came back as a bulleted list, and the lines of a
    // multi-line quote came back as list items.
    //
    // `+` and `1.` also need covering by hand: the default only escapes them
    // when a space follows, but a marker alone on a line is a valid *empty*
    // list item, so `+` as a whole paragraph would return as an empty list and
    // be dropped, losing the text. `1)` is missing entirely, and adjacent
    // ordered lists are written with `)` (see `orderedList`).
    const atLineStart =
      index === 0 || (index > 0 && parent.child(index - 1).type.name === "hardBreak");
    const atBlockEnd = index === parent.childCount - 1;

    let prefix = "";
    let rest = text;

    if (atLineStart && parent.type.name !== "codeBlock") {
      const marker = /^(\s*)([-*+>#]|\d+[.)])/.exec(rest);
      if (marker) {
        // Leading whitespace has no markdown spelling at the start of a line —
        // it is stripped on read — so it is dropped rather than written out.
        prefix = marker[2].replace(/[-*+>#.)]/g, (c) => `\\${c}`);
        rest = rest.slice(marker[0].length);
      }
    }

    // A run of `#` at the end of an ATX heading is its optional closing
    // sequence and is discarded on re-read, so `# #` comes back as an empty
    // heading. Escaping the run keeps it as content.
    let suffix = "";
    if (parent.type.name === "heading" && atBlockEnd) {
      const trailing = /#+$/.exec(rest);
      if (trailing) {
        suffix = trailing[0].replace(/#/g, "\\#");
        rest = rest.slice(0, trailing.index);
      }
    }

    if (prefix === "" && suffix === "") {
      state.text(text);
      return;
    }

    // Both rules can fire on the same node — a heading reading `-0 #` needs the
    // leading marker *and* the closing sequence escaped — so they compose here
    // rather than each returning early.
    //
    // The middle is escaped explicitly, without start-of-line rules, rather than
    // delegated: once the marker above is written the line no longer starts with
    // one, but the state does not know that, and its start-of-line escaping also
    // depends on what follows — so `"-1."` and `"-1. "` escaped differently and
    // the document never settled.
    state.text(prefix + state.esc(rest, false) + suffix, false);
  },

  paragraph(state, node) {
    state.renderInline(node);
    state.closeBlock(node);
  },

  heading(state, node) {
    state.write(state.repeat("#", Number(node.attrs.level) || 1) + " ");
    state.renderInline(node, false);
    state.closeBlock(node);
  },

  blockquote(state, node) {
    const callout = node.attrs.callout;
    state.wrapBlock("> ", null, node, () => {
      // GFM alert syntax: the marker is the first line inside the quote.
      //
      // `closeBlock` rather than `ensureNewLine` so a blank quoted line follows
      // the marker. Without it the marker and the first body line are one
      // paragraph, and a body starting with `=` or `-` is then read as a setext
      // underline — turning `[!NOTE]` into a heading and losing the callout.
      if (isCalloutKind(callout)) {
        state.write(`[!${callout}]`);
        state.closeBlock(node);
      }
      state.renderContent(node);
    });
  },

  codeBlock(state, node) {
    const text = node.textContent;
    const fence = fenceFor(text);
    state.write(fence + (attrString(node, "language") ?? "") + "\n");
    state.text(text, false);
    state.write("\n");
    state.write(fence);
    state.closeBlock(node);
  },

  horizontalRule(state, node) {
    // `***` rather than the more common `---` on purpose: `---` under a line of
    // text is a setext heading underline, not a thematic break. That collides
    // directly under a callout marker (`> [!NOTE]` followed by a rule turns the
    // marker into an h2) and again with YAML frontmatter fences. `***` has no
    // such second reading anywhere.
    state.write("***");
    state.closeBlock(node);
  },

  bulletList(state, node, parent, index) {
    renderBulletList(state, node, bulletMarker(parent, index));
  },

  orderedList(state, node, parent, index) {
    const start = Number(node.attrs.start) || 1;
    const maxWidth = String(start + node.childCount - 1).length;
    const pad = state.repeat(" ", maxWidth + 2);
    const delimiter = consecutiveSiblings(parent, index, ORDERED_FAMILY) % 2 === 0 ? ". " : ") ";
    state.renderList(node, pad, (i) => {
      const label = String(start + i);
      return state.repeat(" ", maxWidth - label.length) + label + delimiter;
    });
  },

  listItem(state, node) {
    renderItemContent(state, node);
  },

  taskList(state, node, parent, index) {
    renderBulletList(state, node, bulletMarker(parent, index));
  },

  taskItem(state, node) {
    state.write(node.attrs.checked ? "[x] " : "[ ] ");
    renderItemContent(state, node);
  },

  table(state, node) {
    const rows: PMNode[] = [];
    node.forEach((row) => rows.push(row));
    if (rows.length === 0) return;

    const columns = rows.reduce((max, row) => Math.max(max, row.childCount), 0);

    const renderRow = (row: PMNode): string => {
      const cells: string[] = [];
      row.forEach((cell) => cells.push(renderCell(cell)));
      while (cells.length < columns) cells.push("");
      return `| ${cells.join(" | ")} |`;
    };

    // GFM requires a header row, so the first row always becomes one. A table
    // whose first row is body cells is normalised on the first pass, which is
    // exactly what the fixed-point test permits.
    state.write(renderRow(rows[0]));
    state.ensureNewLine();
    state.write(`|${" --- |".repeat(columns)}`);
    for (const row of rows.slice(1)) {
      state.ensureNewLine();
      state.write(renderRow(row));
    }
    state.closeBlock(node);
  },

  // Reached only through `table`, which renders rows and cells itself. Defined
  // so the completeness assertion passes and a stray node cannot throw.
  tableRow(state, node) {
    state.renderContent(node);
  },
  tableCell(state, node) {
    state.renderContent(node);
  },
  tableHeader(state, node) {
    state.renderContent(node);
  },

  image(state, node) {
    const src = attrString(node, "src") ?? "";
    const alt = attrString(node, "alt") ?? "";
    const title = attrString(node, "title");
    state.write(
      `![${state.esc(alt)}](${src.replace(/[()]/g, "\\$&")}${
        title ? ` "${title.replace(/"/g, '\\"')}"` : ""
      })`,
    );
  },

  hardBreak(state, node, parent, index) {
    // A hard break with nothing after it in the block would be dropped on
    // re-parse, so drop it here too and stay a fixed point.
    for (let i = index + 1; i < parent.childCount; i++) {
      if (parent.child(i).type !== node.type) {
        state.write("\\\n");
        return;
      }
    }
  },
};

const marks: MarkdownSerializer["marks"] = {
  bold: { open: "**", close: "**", mixable: true, expelEnclosingWhitespace: true },
  italic: {
    open: (_state, _mark, parent, index) => italicDelimiter(parent, index),
    close: (_state, _mark, parent, index) => italicDelimiter(parent, index - 1),
    mixable: true,
    expelEnclosingWhitespace: true,
  },
  strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
  code: {
    open: (_state, _mark, parent, index) => backticksFor(parent.child(index), -1),
    close: (_state, _mark, parent, index) => backticksFor(parent.child(index - 1), 1),
    escape: false,
  },
  link: {
    open: "[",
    close: (state, mark: Mark) => {
      const href = typeof mark.attrs.href === "string" ? mark.attrs.href : "";
      const title = typeof mark.attrs.title === "string" ? mark.attrs.title : "";
      // Parentheses inside a URL close the destination early unless escaped.
      const target = href.replace(/[()]/g, "\\$&");
      return `](${target}${title ? ` "${title.replace(/"/g, '\\"')}"` : ""})`;
    },
  },
};

/**
 * Delimiters for an inline code span.
 *
 * Two things have to be got right or the content changes on re-read. The run of
 * backticks must be longer than any run inside the text, and one space is
 * stripped from each end of a span that begins and ends with a space — so such
 * content needs a padding space added back, or `` ` x ` `` loses its spaces on
 * every save. CommonMark exempts all-space content from that strip but
 * markdown-it does not, so padding is applied there too.
 */
function backticksFor(node: PMNode, side: number): string {
  const text = node.isText && node.text ? node.text : "";
  const runs = /`+/g;
  let longest = 0;
  let match: RegExpExecArray | null;
  while ((match = runs.exec(text)) !== null) {
    longest = Math.max(longest, match[0].length);
  }

  const spaceBound = text.startsWith(" ") && text.endsWith(" ");
  const ticks = "`".repeat(longest + 1);
  const pad = longest > 0 || spaceBound ? " " : "";

  return side < 0 ? ticks + pad : pad + ticks;
}

/**
 * Fail at import time — which means at build and at test time — rather than
 * silently dropping a node at runtime. This is the guarantee that the editor
 * schema and the serializer cannot drift apart.
 */
function assertComplete(): void {
  // `doc` is the serialization entry point and never dispatched on; everything
  // else in the schema, `text` included, needs an explicit writer.
  const structural = new Set(["doc"]);
  const missingNodes = Object.keys(aqliSchema.nodes).filter(
    (name) => !structural.has(name) && !(name in nodes),
  );
  const missingMarks = Object.keys(aqliSchema.marks).filter(
    (name) => !(name in marks),
  );
  const strayNodes = Object.keys(nodes).filter(
    (name) => !(name in aqliSchema.nodes),
  );
  const strayMarks = Object.keys(marks).filter(
    (name) => !(name in aqliSchema.marks),
  );

  const problems: string[] = [];
  if (missingNodes.length) {
    problems.push(`nodes in the schema with no serializer: ${missingNodes.join(", ")}`);
  }
  if (missingMarks.length) {
    problems.push(`marks in the schema with no serializer: ${missingMarks.join(", ")}`);
  }
  if (strayNodes.length) {
    problems.push(`serializers for nodes not in the schema: ${strayNodes.join(", ")}`);
  }
  if (strayMarks.length) {
    problems.push(`serializers for marks not in the schema: ${strayMarks.join(", ")}`);
  }

  if (problems.length) {
    throw new Error(
      `Aqli markdown serializer is out of sync with the editor schema:\n  ${problems.join(
        "\n  ",
      )}\nEvery allowlisted node must have an explicit markdown representation ` +
        `(spec §4.1) — otherwise its content is lost on save.`,
    );
  }
}

assertComplete();

/**
 * Every literal underscore in prose is escaped.
 *
 * The default escaping skips underscores it judges to be intraword, and it
 * counts `_` itself as a word character — so in `__A__` only the outer pair is
 * escaped and the inner two are left to pair up as emphasis on the next parse.
 * `_` is also the italic delimiter next to bold (see `italicDelimiter`), where a
 * bare neighbour stops the delimiter working and the mark is lost. Escaping all
 * of them settles both cases.
 *
 * This does not touch identifiers written as code — the `code` mark disables
 * escaping — so `` `snake_case` `` stays as written and only prose underscores
 * gain a backslash. The lookbehind leaves already-escaped ones alone.
 */
export const aqliMarkdownSerializer = new MarkdownSerializer(nodes, marks, {
  strict: true,
  hardBreakNodeName: "hardBreak",
  escapeExtraCharacters: /(?<!\\)_/g,
});
