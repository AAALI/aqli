/**
 * The markdown pipeline. Everything that reads or writes Aqli markdown — the
 * editor, the agent API, the Confluence importer, and eventually the MCP server
 * — goes through here, so that all of them produce byte-identical output and
 * the round-trip gate in `__tests__/round-trip.test.ts` means something.
 */
import type { Node as PMNode } from "@tiptap/pm/model";
import { aqliSchema } from "./schema";
import { aqliMarkdownSerializer } from "./serializer";
import { parseMarkdown } from "./parser";

export { aqliSchema, aqliExtensions, ALLOWED_NODES, ALLOWED_MARKS } from "./schema";
export type { CalloutKind } from "./schema";

/** The shape `body_json` holds: a Tiptap/ProseMirror document as plain JSON. */
export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

export type TiptapJSON = Record<string, unknown>;

type JSONNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
};

/**
 * Drop anything the allowlist no longer admits before handing JSON to
 * ProseMirror, which throws on an unknown node or mark.
 *
 * This matters for documents written before the schema was constrained: they
 * can carry an `underline` mark, and a saved document must still open. Unknown
 * nodes are unwrapped rather than deleted so their text survives.
 */
function sanitize(node: JSONNode): JSONNode[] {
  const children = (node.content ?? []).flatMap(sanitize);

  if (node.type === "text") {
    const marks = (node.marks ?? []).filter(
      (mark) => typeof mark.type === "string" && mark.type in aqliSchema.marks,
    );
    return [{ ...node, marks }];
  }

  if (!node.type || !(node.type in aqliSchema.nodes)) {
    return children;
  }

  return [node.content ? { ...node, content: children } : node];
}

/**
 * Serialize a ProseMirror document to canonical Aqli markdown.
 *
 * `tightLists` matters more than it looks: without it every list gains a blank
 * line between items, so importing a document and saving it back rewrites lists
 * that nobody touched. Still a fixed point either way, but a noisy one.
 */
export function serialize(doc: PMNode): string {
  const markdown = aqliMarkdownSerializer.serialize(doc, { tightLists: true }).trim();
  return markdown.length > 0 ? `${markdown}\n` : "";
}

/** Parse markdown into a ProseMirror document. */
export function parse(markdown: string): PMNode {
  return parseMarkdown(markdown);
}

/**
 * Markdown is a fixed point when serializing its parse reproduces it exactly.
 * The first pass normalises (`*` bullets become `-`, setext headings become
 * ATX); every pass after that must be a no-op, which is what guarantees an edit
 * cycle never quietly rewrites a document.
 */
export function normalize(markdown: string): string {
  return serialize(parse(markdown));
}

export function isFixedPoint(markdown: string): boolean {
  const once = normalize(markdown);
  return normalize(once) === once;
}

/** Tiptap JSON -> markdown. */
export function tiptapToMarkdown(doc: TiptapJSON | null | undefined): string {
  if (!doc) return "";
  const [sanitized] = sanitize(doc as JSONNode);
  if (!sanitized) return "";
  return serialize(aqliSchema.nodeFromJSON(sanitized));
}

/** Markdown -> Tiptap JSON. */
export function markdownToTiptap(markdown: string | null | undefined): TiptapNode {
  return parse(markdown ?? "").toJSON() as TiptapNode;
}
