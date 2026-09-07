export type CommentType =
  | "comment"
  | "review_request"
  | "approval"
  | "rejection"
  | "change_request";

/** The review trail: types written by the review path, not by a person typing. */
export const REVIEW_TRAIL_TYPES: readonly CommentType[] = [
  "review_request",
  "approval",
  "rejection",
  "change_request",
];

export function isReviewTrail(type: CommentType): boolean {
  return REVIEW_TRAIL_TYPES.includes(type);
}

export type DocComment = {
  id: string;
  doc_id: string;
  workspace_id: string;
  author_id: string | null;
  body: string;
  comment_type: CommentType;
  /**
   * User ids named in `body`. Written by the server from the body itself and
   * filtered to workspace members — see `lib/mentions.ts`.
   */
  mentions: string[];
  created_at: string;
};

/** A comment plus the display name of whoever wrote it. */
export type DocCommentView = DocComment & {
  author_name: string | null;
};

/**
 * What the thread endpoint returns: the comments, and the current
 * `user_id → display name` directory the client needs to render the mentions
 * inside them.
 */
export type DocCommentThread = {
  comments: DocCommentView[];
  names: Record<string, string>;
};
