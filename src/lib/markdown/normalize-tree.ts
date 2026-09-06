/**
 * Bring a Tiptap document into the shape markdown can actually express, before
 * it is serialized.
 *
 * The serializer maps every allowlisted node to markdown, but a node can still
 * hold *content* markdown has no spelling for. Three kinds turned up in real
 * documents, all of them written by paths that build Tiptap JSON directly (the
 * PR pipeline and the old hand-rolled converter) rather than by the editor:
 *
 *   1. A text node containing raw newlines. ProseMirror represents a line break
 *      as a `hardBreak` node; a literal `\n` inside text is not a line break to
 *      markdown, it is a *soft* one, which the next parse joins back into a
 *      single line. Line structure is silently lost.
 *   2. Leading or trailing whitespace on a block. Markdown strips both, so
 *      writing them out guarantees the next read differs from what was written.
 *   3. A blank line inside a paragraph (`\n\n`). Markdown reads that as a
 *      paragraph boundary, so the one paragraph comes back as two.
 *
 * None of this is theoretical: 22 of 83 production documents failed the
 * round-trip gate on it, and one of them turned a paragraph beginning `"  - "`
 * into a bulleted list on every read.
 *
 * Normalizing here rather than in the serializer is deliberate. The fix is
 * structural — one paragraph legitimately becomes two — and a
 * `MarkdownSerializer` node function can only write text, not restructure the
 * document around it.
 */

import { aqliSchema } from "./schema";

export type TreeNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TreeNode[];
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
};

/** Blocks markdown renders on a single line, where a break cannot survive. */
const SINGLE_LINE_BLOCKS = new Set(["heading"]);

/** Blocks whose inline content markdown can split across paragraphs. */
const SPLITTABLE_BLOCKS = new Set(["paragraph"]);

/** Content is verbatim here; a newline is real and must not be touched. */
const VERBATIM_BLOCKS = new Set(["codeBlock"]);

const LIST_ITEMS = new Set(["listItem", "taskItem"]);
const LISTS = new Set(["bulletList", "orderedList", "taskList"]);

function isText(node: TreeNode): boolean {
  return node.type === "text" && typeof node.text === "string";
}

/**
 * Split inline content into one group per paragraph.
 *
 * A run of two or more newlines starts a new group; a single newline becomes a
 * `hardBreak`, which is the only line break markdown can round-trip.
 */
function splitIntoParagraphs(children: TreeNode[]): TreeNode[][] {
  const groups: TreeNode[][] = [[]];

  for (const child of children) {
    let current = groups[groups.length - 1];

    if (!isText(child) || !child.text!.includes("\n")) {
      current.push(child);
      continue;
    }

    const paragraphs = child.text!.split(/\n{2,}/);
    paragraphs.forEach((paragraph, paragraphIndex) => {
      if (paragraphIndex > 0) {
        current = [];
        groups.push(current);
      }
      paragraph.split("\n").forEach((line, lineIndex) => {
        if (lineIndex > 0) current.push({ type: "hardBreak" });
        if (line.length > 0) current.push({ ...child, text: line });
      });
    });
  }

  return groups;
}

/**
 * Join neighbouring text nodes that carry the same marks.
 *
 * A parse always produces the merged form, so leaving the split form here makes
 * escaping depend on where the node boundaries happen to fall: `"-"` followed by
 * `"1."` escapes only the hyphen, while the merged `"-1."` escapes both. The two
 * then disagree forever.
 */
function mergeAdjacentText(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  for (const node of nodes) {
    const previous = out[out.length - 1];
    const sameMarks =
      previous &&
      isText(previous) &&
      isText(node) &&
      JSON.stringify(previous.marks ?? []) === JSON.stringify(node.marks ?? []);
    if (sameMarks) out[out.length - 1] = { ...previous, text: previous.text! + node.text! };
    else out.push(node);
  }
  return out;
}

/**
 * Remove the whitespace markdown would drop anyway.
 *
 * At the start and end of a block, and on either side of a hard break, leading
 * and trailing spaces have no markdown spelling — writing them means the next
 * read differs from the write.
 */
function trimEdges(group: TreeNode[]): TreeNode[] {
  const nodes = mergeAdjacentText(group);

  /**
   * Whitespace inside `code` is content (`` ` x ` `` is padded on purpose) and
   * whitespace inside a link's text sits safely inside the brackets. Every other
   * mark has its edge whitespace expelled outside the delimiters by the
   * serializer, which lands it at the start of a line — where markdown drops it.
   */
  const trimmable = (node: TreeNode) =>
    isText(node) && !(node.marks ?? []).some((m) => m.type === "code" || m.type === "link");

  const stripAt = (index: number, side: "start" | "end") => {
    // Removing an emptied node exposes the next one, which is now the edge.
    while (index >= 0 && index < nodes.length && trimmable(nodes[index])) {
      const node = nodes[index];
      const text =
        side === "start" ? node.text!.replace(/^\s+/, "") : node.text!.replace(/\s+$/, "");
      if (text.length > 0) {
        nodes[index] = { ...node, text };
        return;
      }
      nodes.splice(index, 1);
      if (side === "end") index--;
    }
  };

  // Repeated because the two rules feed each other: stripping a whitespace-only
  // node can expose a hard break at the edge, and removing that hard break can
  // expose more whitespace behind it.
  let previousLength = -1;
  while (nodes.length !== previousLength) {
    previousLength = nodes.length;

    // A hard break at either edge of a block has nothing to separate.
    while (nodes.length > 0 && nodes[0].type === "hardBreak") nodes.shift();
    while (nodes.length > 0 && nodes[nodes.length - 1].type === "hardBreak") nodes.pop();

    stripAt(0, "start");
    stripAt(nodes.length - 1, "end");
  }

  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodes[i].type !== "hardBreak") continue;
    stripAt(i + 1, "start");
    stripAt(i - 1, "end");
  }

  return nodes;
}

/**
 * Marks written as a delimiter run, and therefore subject to CommonMark's
 * flanking rules. `code` and `link` use brackets, which always parse.
 */
const FLANKING_MARKS = new Set(["bold", "italic", "strike"]);

const PUNCTUATION = /[\p{P}\p{S}]/u;
const WHITESPACE = /\s/;

function markName(mark: { type?: string }): string {
  return mark.type ?? "";
}

function hasMark(node: TreeNode, name: string): boolean {
  return (node.marks ?? []).some((mark) => markName(mark) === name);
}

/**
 * Drop a mark whose delimiters CommonMark would refuse to pair.
 *
 * A `**` run can only open if it is not followed by punctuation, or is itself
 * preceded by whitespace or punctuation. So bold text beginning with `)` and
 * sitting directly after a word character has no markdown spelling: writing
 * `a**)**` gives back the literal asterisks, not a bold `)`. The editor reaches
 * that state easily — type a word, turn on bold, type a bracket.
 *
 * Left alone it is worse than losing the mark: the reader sees `**` as text. So
 * the mark is dropped here, once and deterministically, rather than degrading
 * into visible punctuation on the first save. This is a genuine limit of
 * markdown rather than a defect in the serializer, and it is recorded with the
 * other known lossy edges.
 */
function dropUnspellableMarks(group: TreeNode[]): TreeNode[] {
  // Dropping a mark can leave two neighbours carrying the same (empty) set, so
  // the result is merged again before it is handed on.
  const nodes = group.map((node) => ({ ...node }));

  for (const name of FLANKING_MARKS) {
    for (let start = 0; start < nodes.length; start++) {
      if (!isText(nodes[start]) || !hasMark(nodes[start], name)) continue;

      let end = start;
      while (end + 1 < nodes.length && isText(nodes[end + 1]) && hasMark(nodes[end + 1], name)) {
        end++;
      }

      const content = nodes
        .slice(start, end + 1)
        .map((node) => node.text!)
        .join("");

      // The serializer expels whitespace from the edges of a mark, so it is the
      // trimmed content that meets the delimiters — and whatever was expelled
      // becomes the neighbouring character.
      const trimmed = content.trim();
      const expelledBefore = content.length > 0 && WHITESPACE.test(content[0]);
      const expelledAfter = content.length > 0 && WHITESPACE.test(content[content.length - 1]);

      const previous = nodes[start - 1];
      const next = nodes[end + 1];
      const before = expelledBefore
        ? " "
        : previous && isText(previous) && previous.text!.length > 0
          ? previous.text![previous.text!.length - 1]
          : "";
      const after = expelledAfter
        ? " "
        : next && isText(next) && next.text!.length > 0
          ? next.text![0]
          : "";

      const boundary = (char: string) =>
        char === "" || WHITESPACE.test(char) || PUNCTUATION.test(char);

      const canOpen = trimmed.length > 0 && (!PUNCTUATION.test(trimmed[0]) || boundary(before));
      const canClose =
        trimmed.length > 0 &&
        (!PUNCTUATION.test(trimmed[trimmed.length - 1]) || boundary(after));

      if (!canOpen || !canClose) {
        for (let i = start; i <= end; i++) {
          nodes[i] = {
            ...nodes[i],
            marks: (nodes[i].marks ?? []).filter((mark) => markName(mark) !== name),
          };
        }
      }

      start = end;
    }
  }

  return mergeAdjacentText(nodes);
}

/** Collapse every run of whitespace, including newlines, to a single space. */
function flattenToOneLine(children: TreeNode[]): TreeNode[] {
  return trimEdges(
    children
      .filter((child) => child.type !== "hardBreak")
      .map((child) =>
        isText(child) ? { ...child, text: child.text!.replace(/\s+/g, " ") } : child,
      ),
  );
}

/**
 * Rewrite a document so that serializing it produces markdown which parses back
 * to the same document. Returns the node's replacements, because a paragraph
 * holding a blank line becomes more than one paragraph.
 */
export function normalizeForMarkdown(node: TreeNode): TreeNode[] {
  if (!node.type || VERBATIM_BLOCKS.has(node.type) || isText(node)) return [node];

  const children = node.content ?? [];

  if (SINGLE_LINE_BLOCKS.has(node.type)) {
    const inline = dropUnspellableMarks(flattenToOneLine(children));
    return inline.length > 0 ? [{ ...node, content: inline }] : [];
  }

  if (SPLITTABLE_BLOCKS.has(node.type)) {
    const groups = splitIntoParagraphs(children)
      .map(trimEdges)
      .map(dropUnspellableMarks)
      .filter((g) => g.length > 0);
    // An empty paragraph is meaningful structure — `listItem` requires a leading
    // one, and the serializer already knows to skip it — so it is preserved
    // rather than dropped here.
    if (groups.length === 0) return [{ ...node, content: [] }];
    return groups.map((group) => ({ ...node, content: group }));
  }

  if (node.content === undefined) return [node];

  let content = children.flatMap(normalizeForMarkdown);

  // These three rules mirror `normalizeJSON` in the parser exactly. They have to:
  // any shape the parser removes on the way in but the serializer writes on the
  // way out is a document that changes every time it is saved.

  // A blank line only separates blocks, so an empty paragraph beside other
  // content cannot come back. List items are exempt — their content is
  // `paragraph block*`, so a leading empty paragraph is structural, and the
  // serializer skips writing it rather than dropping it.
  if (content.length > 1 && !LIST_ITEMS.has(node.type)) {
    const kept = content.filter(
      (child) => !(child.type === "paragraph" && (child.content ?? []).length === 0),
    );
    if (kept.length > 0) content = kept;
  }

  // An empty list item has no markdown spelling: it serializes to a bare `- `,
  // which the next parse absorbs as literal text rather than reading back as an
  // item. Dropping it here makes that loss happen once and deterministically,
  // rather than on the first save after the flip.
  if (LIST_ITEMS.has(node.type) && !hasVisibleContent(content)) return [];
  if (LISTS.has(node.type) && content.length === 0) return [];

  // Dropping content can empty a container whose schema demands children.
  if (content.length === 0 && !aqliSchema.nodes[node.type]?.contentMatch.validEnd) {
    content = [{ type: "paragraph" }];
  }

  return [{ ...node, content }];
}

function hasVisibleContent(nodes: TreeNode[]): boolean {
  return nodes.some((node) => {
    if (isText(node)) return node.text!.length > 0;
    if (node.type === "hardBreak") return false;
    if (node.content === undefined) return true; // image, horizontalRule
    return hasVisibleContent(node.content);
  });
}
