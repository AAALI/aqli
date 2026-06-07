export type ApiKey = {
  id: string;
  workspace_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  last_used_at: string | null;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
};

export type ApiKeyWithSecret = ApiKey & {
  // Plain key — only returned once on creation. Never stored in plain text.
  secret: string;
};
