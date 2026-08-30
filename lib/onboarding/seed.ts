/**
 * Putting the starter documents into a new workspace.
 *
 * Deliberately its own module, imported only by the workspace-creation route.
 * Seeding goes through the proposal path, which reaches the markdown-to-Tiptap
 * converter; `lib/supabase/workspaces.ts` is imported by nearly every page, so
 * doing this there dragged that graph into the whole app and cost 245 KiB of
 * worker bundle for code no page renders (C4). One route pays for it instead.
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { proposeAgentDoc } from "@/lib/supabase/agent-docs";
import { starterDocs } from "./starter-docs";

export async function seedStarterDocs(workspace: { id: string; name: string }): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const spaceId = (spaces?.[0]?.id as string | undefined) ?? null;

  for (const doc of starterDocs(workspace.name)) {
    await proposeAgentDoc({
      workspaceId: workspace.id,
      agentKeyId: null,
      origin: "system",
      spaceId,
      title: doc.title,
      bodyMd: doc.bodyMd,
      type: "general",
      // They describe how the workspace works rather than proposing anything,
      // and the staleness clock will bring them back round for a look.
      status: "approved",
      frontmatter: { tags: ["how-we-work"] },
      rationale: "Seeded when the workspace was created",
      trusted: true,
      markReviewed: true,
    });
  }
}
