export type ActorType = "human" | "agent";

export type ActivityAction =
  | "created"
  | "updated"
  | "status_changed"
  | "reviewed"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "embedded"
  | "review_requested";

export type DocActivity = {
  id: string;
  doc_id: string;
  workspace_id: string;
  actor_type: ActorType;
  actor_id: string | null;
  actor_name: string | null;
  action: ActivityAction;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** doc_activity row joined with a lightweight doc summary (workspace agent log). */
export type DocActivityWithDoc = DocActivity & {
  doc: {
    id: string;
    title: string;
    type: string;
    status: string;
    space_id: string | null;
  } | null;
};
