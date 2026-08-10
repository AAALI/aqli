import type { IntegrationConnection } from "@/types/integration";

/**
 * Whether PR-sourced docs skip review for this connection.
 *
 * One line, in its own file, because of what importing it used to cost. It
 * lived in `feature-doc.ts`, and the integrations settings page imported it
 * from there — so the page's server bundle pulled in the whole PR pipeline:
 * the agent doc writer, the markdown converters, `aqliSchema`, and through it
 * every Tiptap extension and ProseMirror. 684 KiB of chunk, inside a 3 MiB
 * Workers budget, to answer `metadata.auto_approve !== false`.
 *
 * Keep this module free of imports beyond types. Anything added here lands in
 * the bundle of every page that wants to know the policy.
 */
export function isAutoApproveEnabled(connection: IntegrationConnection): boolean {
  return connection.metadata?.auto_approve !== false;
}
