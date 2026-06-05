import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaceBySlug } from "@/lib/supabase/spaces";
import { getDocs } from "@/lib/supabase/docs";
import DocList from "@/components/docs/DocList";
import Button from "@/components/ui/Button";

export default async function SpacePage({
  params,
}: {
  params: Promise<{ workspace: string; space: string }>;
}) {
  const { workspace: wsSlug, space: spaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const space = await getSpaceBySlug(workspace.id, spaceSlug).catch(() => null);
  if (!space) notFound();

  const docs = await getDocs(workspace.id, { spaceId: space.id, limit: 100 });

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {space.icon} {space.name}
        </h1>
        <Link href={`/w/${workspace.slug}/s/${space.slug}/new`}>
          <Button>+ New doc</Button>
        </Link>
      </div>
      <DocList
        docs={docs}
        workspaceSlug={workspace.slug}
        emptyLabel="No docs in this space yet."
      />
    </div>
  );
}
