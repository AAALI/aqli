/**
 * The space boundary, on the paths RLS cannot reach.
 *
 * Row-level security holds the line for anything the reader's own session runs
 * — the docs list, the doc view, search, comments, history. It does nothing for
 * the service role, and the service role is what the agent API, MCP, RAG, the
 * review queue, the staleness list and the activity feed all run on, because
 * they need to see across a workspace rather than as one person.
 *
 * So those paths ask this instead. The rule they enforce is the one that keeps
 * an assistant's answers leak-free: **the agent path inherits the visibility of
 * the key's owner**. A private space its owner is not in is not in its answers,
 * not in its search results, and not in its document list — not as a redacted
 * row, not as a title.
 */
import { scoped } from "@/lib/db";

/**
 * The spaces this user may not read: private, and they are not a member.
 *
 * Deliberately the *blocked* list rather than the allowed one. Private spaces
 * are the exception in a workspace, so the list is short — and a caller that
 * forgets to apply it shows too much of its own workspace rather than nothing
 * at all, which is the failure that gets noticed.
 */
export async function blockedSpaceIds(
  workspaceId: string,
  userId: string | null,
): Promise<string[]> {
  const { data, error } = await scoped(workspaceId).rpc("blocked_space_ids", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
  });
  if (error) throw error;

  // A null user — a key whose owner has left the workspace — is a member of
  // nothing, so every private space comes back blocked. That is the database's
  // answer, not a special case here.
  const rows = (data ?? []) as unknown;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) =>
      typeof row === "string" ? row : ((row as { blocked_space_ids?: string }).blocked_space_ids ?? null),
    )
    .filter((id): id is string => typeof id === "string");
}

/**
 * Narrow a PostgREST query on a table with a `space_id` column.
 *
 * `not in` alone would drop rows whose `space_id` is null, because SQL says
 * `null not in (…)` is null rather than true — and a document with no space is
 * workspace-wide, not secret. Hence the explicit `is null` arm.
 */
export function excludeBlockedSpaces<T extends { or: (filter: string) => T }>(
  query: T,
  blocked: string[],
  column = "space_id",
): T {
  if (blocked.length === 0) return query;
  return query.or(`${column}.is.null,${column}.not.in.(${blocked.join(",")})`);
}

/** For rows already in hand — a joined doc, an RPC result. */
export function isSpaceVisible(spaceId: string | null | undefined, blocked: string[]): boolean {
  if (!spaceId) return true;
  return !blocked.includes(spaceId);
}
