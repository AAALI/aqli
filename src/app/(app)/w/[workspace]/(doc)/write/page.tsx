import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces } from "@/lib/supabase/spaces";
import { createDocument } from "@/lib/supabase/docs";
import { logActivity } from "@/lib/supabase/activity";
import type { DocType } from "@/types/doc";
import { DOC_TYPES } from "@/types/doc";

/**
 * "Write" goes straight to a cursor (v3 §5.19).
 *
 * The old `/s/[space]/new` asked for a type and a template before a single
 * word could be typed. It is deleted: this route creates an untitled draft and
 * hands the writer the editor. Where it lives and who should check it are
 * asked once, at publish, when the answers are actually known.
 *
 * A page rather than an API call so every "Start writing" affordance is a
 * plain link — no client-side create-then-navigate dance, and no button that
 * does nothing until a fetch resolves.
 */
export default async function WritePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ space?: string; type?: string }>;
}) {
  const { workspace: slug } = await params;
  const { space: spaceSlug, type } = await searchParams;

  const workspace = await getWorkspaceBySlug(slug).catch(() => null);
  if (!workspace) notFound();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // A draft has to land somewhere, but the writer is not asked: it goes to the
  // space they came from, else the first one, and the publish sheet is where
  // that gets confirmed or changed.
  const spaces = await getSpaces(workspace.id);
  const space = (spaceSlug && spaces.find((s) => s.slug === spaceSlug)) || spaces[0] || null;
  const docType: DocType = DOC_TYPES.includes(type as DocType) ? (type as DocType) : "general";

  const { doc } = await createDocument({
    workspace_id: workspace.id,
    space_id: space?.id ?? null,
    title: "",
    type: docType,
    body_md: "",
    owner_id: user.id,
  });

  // A `review_all` space can queue even a new document, leaving nothing to
  // open. Send them to Drafts rather than to a blank editor that is not theirs.
  if (!doc) redirect(`/w/${workspace.slug}/drafts`);

  await logActivity({
    docId: doc.id,
    workspaceId: workspace.id,
    actorType: "human",
    actorId: user.id,
    actorName:
      (user.user_metadata?.full_name as string | undefined) ?? user.email ?? user.id,
    action: "created",
  }).catch(() => {});

  redirect(`/w/${workspace.slug}/docs/${doc.id}/edit`);
}
