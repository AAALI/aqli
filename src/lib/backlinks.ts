/**
 * Which section of a citing doc a citation sits in.
 *
 * Internal citations are stored in `body_md` as links whose target contains
 * `/docs/<id>` (see the editor's cite/quote inserts). The markdown around the
 * link already says which heading it falls under, so the viewer's "Cited by"
 * list can say *where* it is cited without a new column to maintain:
 * "Rollout plan · cites Deliverables & timeline" is a much better reason to
 * click than the doc title alone.
 *
 * Pure and dependency-free so it can be tested without a Supabase client.
 */
export function citingSection(bodyMd: string | null, docId: string): string | null {
  if (!bodyMd) return null;
  const at = bodyMd.indexOf(`/docs/${docId}`);
  if (at === -1) return null;
  // ATX headings only. A setext heading (underlined with === or ---) is not
  // something this editor can produce, and guessing at one would misread a
  // table rule or a horizontal rule as a section title.
  const headings = bodyMd.slice(0, at).match(/^#{1,6}[ \t]+(.+)$/gm);
  if (!headings || headings.length === 0) return null;
  const text = headings[headings.length - 1]
    .replace(/^#{1,6}[ \t]+/, "")
    // Trailing closing hashes are optional ATX syntax, not part of the title.
    .replace(/\s+#+\s*$/, "")
    .trim();
  return text || null;
}
