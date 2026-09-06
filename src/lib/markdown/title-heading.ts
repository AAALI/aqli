/**
 * Whether a document's body opens with its own title as a `# Heading`.
 *
 * Docs published from a merged PR (and some imports) carry the title twice:
 * once as the row's `title`, once as the first heading of `body_md`. Every
 * surface that shows the title separately has to agree about this, or the same
 * document reads differently depending on where you opened it — the viewer used
 * to drop the heading while the editor showed it, so editing a doc appeared to
 * duplicate its title.
 *
 * The heading stays in `body_md`: it is part of the document as exported,
 * committed back to a PR, or read by an agent. Only the on-screen rendering
 * hides it, and the editor puts it back before saving.
 */

export type TitleNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TitleNode[];
};

/** Concatenate the `text` leaves of a Tiptap node. */
export function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as TitleNode;
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) return n.content.map(nodeText).join("");
  return "";
}

/** True when the first node is a level-1 heading whose text is the title. */
export function hasTitleHeading(
  content: Record<string, unknown> | null | undefined,
  title?: string | null,
): boolean {
  if (!content || !title) return false;
  const nodes = content.content;
  if (!Array.isArray(nodes) || nodes.length === 0) return false;
  const first = nodes[0] as TitleNode;
  if (first?.type !== "heading") return false;
  if (((first.attrs?.level as number | undefined) ?? 1) !== 1) return false;
  return nodeText(first).trim().toLowerCase() === title.trim().toLowerCase();
}

/**
 * The document without its leading title heading.
 *
 * A document whose entire body is that heading strips to nothing, and the
 * schema's `doc` node requires `block+` — an empty content array is rejected by
 * `nodeFromJSON`, so the editor would fail to open it. It gets an empty
 * paragraph instead, which is what a blank document is anyway and which
 * serializes back to nothing.
 */
export function stripTitleHeading(
  content: Record<string, unknown>,
): Record<string, unknown> {
  const nodes = content.content;
  if (!Array.isArray(nodes)) return content;
  const rest = nodes.slice(1);
  return { ...content, content: rest.length > 0 ? rest : [{ type: "paragraph" }] };
}

/**
 * Put the title back at the top, as the editor must before it writes markdown.
 * Uses the current title, so renaming the doc renames the heading with it
 * rather than leaving the body asserting the old name.
 */
export function prependTitleHeading(
  content: Record<string, unknown>,
  title: string,
): Record<string, unknown> {
  const nodes = Array.isArray(content.content) ? content.content : [];
  const heading: TitleNode = {
    type: "heading",
    attrs: { level: 1 },
    content: title ? [{ type: "text", text: title }] : [],
  };
  return { ...content, content: [heading, ...nodes] };
}
