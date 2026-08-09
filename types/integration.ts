export type IntegrationProvider = "github" | "linear";

export type IntegrationStatus =
  | "not_connected"
  | "initiated"
  | "connected"
  | "failed"
  | "expired"
  | "revoked";

export type IntegrationConnection = {
  id: string;
  workspace_id: string;
  user_id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  /**
   * Unused since the direct-GitHub switch, but still written so the
   * commented-out Composio path can be restored without a backfill.
   */
  composio_user_id: string;
  connected_account_id: string | null;
  /** Composio trigger ids. Superseded by `github_hook_ids`. */
  trigger_ids: string[];
  /** GitHub repo webhook ids, one per watched repo. */
  github_hook_ids: number[];
  default_space_id: string | null;
  metadata: Record<string, unknown>;
  last_event_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};
