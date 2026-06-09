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
  composio_user_id: string;
  connected_account_id: string | null;
  trigger_ids: string[];
  default_space_id: string | null;
  metadata: Record<string, unknown>;
  last_event_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};
