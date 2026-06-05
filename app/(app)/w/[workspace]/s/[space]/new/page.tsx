import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaceBySlug } from "@/lib/supabase/spaces";
import NewDocClient from "./NewDocClient";

export default async function NewDocPage({
  params,
}: {
  params: Promise<{ workspace: string; space: string }>;
}) {
  const { workspace: wsSlug, space: spaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const space = await getSpaceBySlug(workspace.id, spaceSlug).catch(() => null);
  if (!space) notFound();

  return (
    <NewDocClient
      workspaceId={workspace.id}
      workspaceSlug={workspace.slug}
      spaceId={space.id}
      spaceName={space.name}
    />
  );
}
