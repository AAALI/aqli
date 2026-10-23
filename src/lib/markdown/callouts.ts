/**
 * The callout vocabulary (spec §4.1): GFM alert kinds, spelled `> [!NOTE]`.
 *
 * In its own module, free of Tiptap, so the token normalisers and the
 * server-side HTML renderer can use it without pulling the editor schema —
 * and therefore ProseMirror — into the server bundle. `schema.ts` re-exports
 * it, so nothing that imported it from there has moved.
 */
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
