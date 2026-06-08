import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getStaleDocs, DEFAULT_STALE_DAYS } from "@/lib/supabase/stale";
import AppTopBar from "@/components/layout/AppTopBar";
import StaleClient from "./StaleClient";

export default async function StalePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;
  const docs = await getStaleDocs(workspace.id);

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Stale docs" }]} />
      <StaleClient docs={docs} workspaceSlug={workspace.slug} staleDays={DEFAULT_STALE_DAYS} />
    </>
  );
}
