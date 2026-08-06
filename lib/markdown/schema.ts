/**
 * The one definition of what an Aqli document may contain.
 *
 * Spec §4.1 fixes an allowlist of nodes and marks chosen because they all have
 * an unambiguous markdown representation. Once `body_md` is canonical (step 6),
 * anything the editor can produce but the serializer cannot write is permanent
 * data loss — so the editor schema and the markdown serializer are derived from
 * this file rather than maintained in parallel.
 *
 * `aqliSchema` is built with Tiptap's own `getSchema` from the same extension
 * list the editor mounts, so the two cannot drift: adding a node to the editor
 * without teaching the serializer about it fails the assertion in
 * `serializer.ts` at import time.
 *
 * Note what is deliberately absent: StarterKit ships an `underline` mark, and
 * markdown has no underline. Today that silently degrades to plain text on
 * every save. It is disabled here.
 */
import { getSchema, type Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Blockquote from "@tiptap/extension-blockquote";
import CodeBlock from "@tiptap/extension-code-block";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import type { Schema } from "@tiptap/pm/model";

/** GFM alert kinds, the callout vocabulary from spec §4.1. */
export const CALLOUT_KINDS = [
  "NOTE",
  "TIP",
  "IMPORTANT",
  "WARNING",
  "CAUTION",
] as const;

export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export function isCalloutKind(value: unknown): value is CalloutKind {
  return (
    typeof value === "string" &&
    (CALLOUT_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Callouts are a blockquote carrying an attribute, not a custom node type, so
 * they survive any markdown consumer that has never heard of Aqli. A reader
 * that does not understand `> [!NOTE]` still sees a blockquote.
 */
const AqliBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      callout: {
        default: null as CalloutKind | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-callout"),
        renderHTML: (attributes: Record<string, unknown>) =>
          isCalloutKind(attributes.callout)
            ? { "data-callout": attributes.callout }
            : {},
      },
    };
  },
});

/** The plain code block. `AqliEditor` swaps in the mermaid-rendering variant,
 *  which extends this one and so produces an identical schema. */
export const AqliCodeBlock = CodeBlock.configure({
  languageClassPrefix: "language-",
});

/**
 * The allowlisted extension set.
 *
 * @param codeBlock Optional replacement for the code block extension. It must
 *   extend `CodeBlock` so the schema shape is unchanged — this exists so the
 *   editor can attach a React node view without forking the schema.
 */
export function aqliExtensions(
  codeBlock: Extensions[number] = AqliCodeBlock,
): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Replaced below with variants that carry extra attributes or views.
      blockquote: false,
      codeBlock: false,
      // No markdown representation. Enabling it guarantees silent data loss.
      underline: false,
      link: { openOnClick: false },
    }),
    AqliBlockquote,
    codeBlock,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    // `inline: true` is load-bearing, not a style choice. Markdown has no block
    // image: `![alt](src)` is an inline construct, so markdown-it emits it
    // inside a paragraph's inline token run. Tiptap's Image defaults to
    // `inline: false`, which makes it a block node — and ProseMirror will not
    // put a block inside a paragraph, so the image was dropped on parse and
    // took the rest of the paragraph's text with it.
    Image.configure({ inline: true }),
  ];
}

/** The ProseMirror schema the markdown pipeline serializes and parses against. */
export const aqliSchema: Schema = getSchema(aqliExtensions());

/**
 * Node names in the allowlist, excluding `doc` and `text` which the serializer
 * never dispatches on. Exported so the completeness assertion and the tests can
 * both enumerate them.
 */
export const ALLOWED_NODES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "codeBlock",
  "blockquote",
  "horizontalRule",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "image",
  "hardBreak",
] as const;

export const ALLOWED_MARKS = ["bold", "italic", "code", "strike", "link"] as const;
