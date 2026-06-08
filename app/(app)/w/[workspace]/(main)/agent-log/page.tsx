import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getWorkspaceAgentActivity } from "@/lib/supabase/activity";
import AppTopBar from "@/components/layout/AppTopBar";
import AgentLogClient from "./AgentLogClient";

export default async function AgentLogPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;
  const activities = await getWorkspaceAgentActivity(workspace.id);

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Agent Activity" }]} />
      <AgentLogClient activities={activities} workspaceSlug={workspace.slug} />
    </>
  );
}
