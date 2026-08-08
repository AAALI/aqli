import { createServerSupabaseClient } from "./server";
import { getOwnerDirectory } from "./owners";
import { listWorkspaceMembers } from "./members";
import { extractMentionedMembers } from "@/lib/mentions";
import type {
  DocComment,
  DocCommentThread,
  DocCommentView,
} from "@/types/comment";

/**
 * Doc-level comments (roadmap phase 2, item 3).
 *
 * Everything here goes through the **RLS-respecting** request client rather
 * than `lib/db`'s service client, the same way `getOpenProposals` does: since
 * `20260808000000_doc_comments.sql` the table has policies that already answer
 * every question this module would otherwise have to ask in TypeScript — who
 * may read a thread, who may post to it, whether the doc really belongs to the
 * workspace on the row, and whether a row is a comment or a review-trail entry
 * that nobody gets to delete. Using the service client here would step around
 * all of it and leave those rules enforced in one place instead of two.
 *
 * The one thing the database cannot do is decide what `mentions` should
 * contain, because that means reading the body and knowing who is a member.
 * That happens here, on the way in, and the client's own idea of who it
 * mentioned is never consulted.
 */

const MAX_BODY = 10_000;

/**
 * The thread on a doc, oldest first — a conversation reads downward, unlike the
 * activity log.
 *
 * Returns the member directory alongside it so mentions render with whatever
 * the named people are called *today*, not the label frozen into the body when
 * the comment was written.
 */
export async function getDocCommentThread(
  workspaceId: string,
  docId: string,
): Promise<DocCommentThread> {
  const supabase = await createServerSupabaseClient();
  const [{ data, error }, directory] = await Promise.all([
    supabase
      .from("doc_comments")
      .select("*")
      .eq("doc_id", docId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    getOwnerDirectory(workspaceId),
  ]);
  if (error) throw error;

  const names: Record<string, string> = {};
  for (const [id, info] of Object.entries(directory)) names[id] = info.name;

  const comments: DocCommentView[] = ((data ?? []) as DocComment[]).map((c) => ({
    ...c,
    mentions: c.mentions ?? [],
    // A null author is a comment from someone since removed from the
    // workspace; the row survives them, so say so rather than showing nothing.
    author_name: c.author_id ? (names[c.author_id] ?? "Former member") : null,
  }));

  return { comments, names };
}

export class CommentError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CommentError";
  }
}

/**
 * Post a comment as the signed-in user.
 *
 * `author_id` is taken from the session and never from the caller — the insert
 * policy requires the two to match, so passing anything else fails at the
 * database rather than posting under someone else's name.
 */
export async function createDocComment(
  workspaceId: string,
  docId: string,
  body: string,
): Promise<DocCommentView> {
  const text = body.trim();
  if (!text) throw new CommentError(400, "A comment needs some text.");
  if (text.length > MAX_BODY)
    throw new CommentError(400, `A comment cannot be longer than ${MAX_BODY} characters.`);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new CommentError(401, "Unauthorized");

  // Resolve mentions against the member list. Anyone named who is not a member
  // stays in the text and gets no notification — see `extractMentionedMembers`.
  const members = await listWorkspaceMembers(workspaceId).catch(() => []);
  const mentions = extractMentionedMembers(
    text,
    members.map((m) => m.user_id),
  );

  const { data, error } = await supabase
    .from("doc_comments")
    .insert({
      doc_id: docId,
      workspace_id: workspaceId,
      author_id: user.id,
      body: text,
      comment_type: "comment",
      mentions,
    })
    .select("*")
    .single();

  // The insert policy is what rejects a viewer, a non-member, or a doc in
  // another workspace. PostgREST reports all three the same way, and the
  // honest answer to the caller is the same too: you cannot post this.
  if (error) {
    if (error.code === "42501")
      throw new CommentError(403, "You do not have permission to comment on this doc.");
    throw error;
  }

  const author =
    (user.user_metadata?.full_name as string | undefined) || user.email || null;

  return { ...(data as DocComment), mentions, author_name: author };
}

/**
 * Delete a comment.
 *
 * Authorisation is entirely the delete policy's: your own comment, or any
 * comment in a workspace you administer, and never a review-trail entry. A row
 * the policy hides simply does not delete, which is why the count is checked
 * and reported as a 403 rather than a silent success.
 */
export async function deleteDocComment(
  workspaceId: string,
  commentId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("doc_comments")
    .delete()
    .eq("id", commentId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0)
    throw new CommentError(403, "That comment cannot be deleted.");
}

/**
 * Comments mentioning `userId`, most recent first, with the doc they are on.
 *
 * Powers the mention rows in the notification feed. Read on the RLS client, so
 * it is inherently limited to workspaces the caller belongs to.
 */
export async function getMentionsOfUser(
  workspaceId: string,
  userId: string,
  limit = 15,
): Promise<(DocComment & { doc: { id: string; title: string; space_id: string | null } | null })[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("doc_comments")
    .select("*, doc:docs(id, title, space_id)")
    .eq("workspace_id", workspaceId)
    .contains("mentions", [userId])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as (DocComment & {
    doc: { id: string; title: string; space_id: string | null } | null;
  })[];
}
