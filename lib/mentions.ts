/**
 * @mentions in comment bodies.
 *
 * A comment body is plain text, not an Aqli document — it never goes through
 * the markdown pipeline in `lib/markdown/`, and deliberately so. Adding a
 * mention node to `lib/markdown/schema.ts` would put a node in the allowlist
 * that the serializer has to round-trip, and `body_md` is canonical: anything
 * the schema can hold but markdown cannot express is permanent data loss. The
 * comment thread is a separate surface with a separate, much smaller grammar.
 *
 * That grammar is one token:
 *
 *   @[Ada Lovelace](user:0f9c1e8a-....)
 *
 * Link-shaped on purpose. A reader that has never heard of Aqli — an export,
 * a plain-text digest, a diff — still shows a name next to an `@`, and the id
 * rather than the name is what identifies the person, so a mention keeps
 * pointing at the right member after they change how their name is spelled.
 * The label is a cache for those dumb readers; every renderer here re-resolves
 * the id against the current member directory and only falls back to the
 * stored label when the id is unknown.
 */

/** The stored form of one mention. */
export type Mention = { userId: string; label: string };

export type MentionSegment =
  | { type: "text"; text: string }
  | { type: "mention"; userId: string; label: string };

const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/**
 * `@[label](user:uuid)`.
 *
 * The label is anything but a bracket, which keeps the match from running past
 * its own closing `]` into the next mention on the line.
 */
const MENTION_RE = new RegExp(`@\\[([^\\]\\[]{1,120})\\]\\(user:(${UUID})\\)`, "g");

/**
 * Write one mention token.
 *
 * Only the characters that would break the parse are removed: the label is
 * delimited by `[` and `]`, so those two and newlines are the whole list.
 * Parentheses stay — `withUniqueLabels` uses them to tell two people with the
 * same name apart, and stripping them would mangle the very labels the
 * composer generates.
 */
export function formatMention(userId: string, label: string): string {
  const safe = label.replace(/[[\]\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return `@[${safe || "Member"}](user:${userId})`;
}

/**
 * Every mention in `body`, in the order written, de-duplicated by user id —
 * naming someone three times in one comment is one mention of them.
 */
export function parseMentions(body: string): Mention[] {
  const out: Mention[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) {
    const userId = m[2].toLowerCase();
    if (seen.has(userId)) continue;
    seen.add(userId);
    out.push({ userId, label: m[1] });
  }
  return out;
}

/**
 * The user ids named in `body`, keeping only those in `memberIds`.
 *
 * This is the server's filter and the reason the `mentions` column is never
 * client-supplied: without it, a comment could name any uuid at all, and the
 * notification feed would happily deliver "you were mentioned" to whoever
 * owned it — a way to poke at accounts outside the workspace, or to spam one
 * inside it. Ids that are not members are left in the text (the body is what
 * the author wrote) but are not addressable.
 */
export function extractMentionedMembers(
  body: string,
  memberIds: Iterable<string>,
): string[] {
  const members = new Set(Array.from(memberIds, (id) => id.toLowerCase()));
  return parseMentions(body)
    .map((m) => m.userId)
    .filter((id) => members.has(id));
}

/**
 * Split a body into text and mention runs for rendering.
 *
 * `names` is the current directory (`user_id → display name`). A mention whose
 * id is not in it keeps its stored label — a former member is still a name in
 * a sentence, and blanking it would rewrite history.
 */
export function toSegments(
  body: string,
  names: Record<string, string> = {},
): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let cursor = 0;

  for (const m of body.matchAll(MENTION_RE)) {
    const at = m.index ?? 0;
    if (at > cursor) segments.push({ type: "text", text: body.slice(cursor, at) });
    const userId = m[2].toLowerCase();
    segments.push({ type: "mention", userId, label: names[userId] ?? m[1] });
    cursor = at + m[0].length;
  }

  if (cursor < body.length) segments.push({ type: "text", text: body.slice(cursor) });
  return segments;
}

/**
 * The body as a person reads it: `@Ada Lovelace` rather than the token.
 *
 * Used wherever a comment has to appear as a single string — the notification
 * feed's preview line, and anywhere else without a place to hang markup.
 */
export function toPlainText(
  body: string,
  names: Record<string, string> = {},
): string {
  return toSegments(body, names)
    .map((s) => (s.type === "text" ? s.text : `@${s.label}`))
    .join("");
}
