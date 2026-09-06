import type { AgentScope } from "@/lib/merge/disposition";

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
  /**
   * What this agent may do (spec §2.2). `read` and `propose` are the default;
   * `write` is what lets an agent's change merge without review in a
   * `review_agents` space — see `decideDisposition`.
   */
  scopes: AgentScope[];
};

export type ApiKeyWithSecret = ApiKey & {
  // Plain key — only returned once on creation. Never stored in plain text.
  secret: string;
};
