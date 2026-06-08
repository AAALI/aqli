export type CommentType =
  | "comment"
  | "review_request"
  | "approval"
  | "rejection"
  | "change_request";

export type DocComment = {
  id: string;
  doc_id: string;
  workspace_id: string;
  author_id: string | null;
  body: string;
  comment_type: CommentType;
  created_at: string;
};
