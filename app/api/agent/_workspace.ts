import { createServiceClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export type AgentWorkspaceMeta = {
  slug: string | null;
  /**
   * Workspace policy for agent-created docs. Off by default: agent docs land
   * in the review queue and only become trusted context once a human
   * approves. Set `settings.agent_auto_approve = true` on the workspace to
   * publish agent docs immediately (mirrors the GitHub `auto_approve` policy).
   */
  agentAutoApprove: boolean;
  /** Docs live under /w/{workspace}/docs/{id} — an unprefixed /docs/{id} 404s. */
  docUrl: (docId: string) => string;
};

export async function getAgentWorkspaceMeta(
  workspaceId: string,
): Promise<AgentWorkspaceMeta> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("workspaces")
    .select("slug, settings")
    .eq("id", workspaceId)
    .maybeSingle();

  const slug = data?.slug ?? null;
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const base = slug ? `${APP_URL}/w/${slug}/docs` : `${APP_URL}/docs`;

  return {
    slug,
    agentAutoApprove: settings.agent_auto_approve === true,
    docUrl: (docId: string) => `${base}/${docId}`,
  };
}
