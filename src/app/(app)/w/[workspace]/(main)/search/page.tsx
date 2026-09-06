import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces } from "@/lib/supabase/spaces";
import SearchClient from "./SearchClient";

export default async function SearchPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  // The space filter above the results is a real filter, so it needs the real
  // spaces — it used to be a single hardcoded "All Spaces" pill that did
  // nothing at all.
  const spaces = await getSpaces(workspace.id).catch(() => []);
  return (
    <SearchClient
      workspaceId={workspace.id}
      workspaceSlug={workspace.slug}
      spaces={spaces.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
