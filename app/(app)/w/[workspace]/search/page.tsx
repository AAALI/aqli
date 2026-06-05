import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import SearchClient from "./SearchClient";

export default async function SearchPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  return (
    <SearchClient workspaceId={workspace.id} workspaceSlug={workspace.slug} />
  );
}
