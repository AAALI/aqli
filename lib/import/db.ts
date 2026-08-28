/**
 * The import pipeline, wired to this installation.
 *
 * Everything the pipeline needs from the outside world, implemented against
 * Supabase. It is separate from the pipeline so the interesting cases can be
 * tested without a database, and so the two ingest surfaces — the CLI and the
 * admin upload — cannot drift into two different importers.
 *
 * Writes go through `proposeAgentDoc` with `origin: "system"`, not straight
 * into `docs`. An import is still a write, and C2 does not have an exception
 * for bulk: every page gets a proposal and therefore a revision, so an import
 * is as reviewable and as revertible afterwards as anything a person typed.
 * `trusted` is set because imported pages were the team's live truth and are
 * stamped approved on arrival — the staleness clock, not a wall of 1,361
 * reviews, is what brings them up to date.
 */
import { scoped } from "@/lib/db";
import { proposeAgentDoc } from "@/lib/supabase/agent-docs";
import { DOC_IMAGE_EXTENSIONS, docImageUrl } from "@/lib/doc-images";
import type { ImportDeps } from "./types";

export type ImportTarget = {
  workspaceId: string;
  /** Source space key → Aqli space id. Anything unmapped lands with no space. */
  spaceMap: Record<string, string>;
  /** Source author → member user id. */
  authorMap: Record<string, string>;
  /** Where pages with no space of their own go. */
  defaultSpaceId: string | null;
};

export function importDeps(target: ImportTarget): ImportDeps {
  const db = scoped(target.workspaceId);

  return {
    async findBySource(sourceName, sourceId) {
      const { data, error } = await db
        .from("docs")
        .select("id")
        .contains("source_ref", { source: sourceName, id: sourceId })
        .maybeSingle();
      if (error) throw error;
      return data ? { id: data.id as string } : null;
    },

    async createDoc(input) {
      const result = await proposeAgentDoc({
        workspaceId: input.workspaceId,
        // No key: an importer is not an agent acting for someone, it is the
        // installation replaying content the company already owned.
        agentKeyId: null,
        origin: "system",
        spaceId: input.spaceId,
        parentId: input.parentDocId,
        sourceRef: { source: input.sourceName, id: input.sourceId },
        title: input.title,
        bodyMd: input.bodyMd,
        type: "general",
        // Imported pages were the team's live truth. They arrive approved and
        // the staleness clock starts now, which turns "review 400 pages" into a
        // queue rather than a wall.
        status: "approved",
        frontmatter: { tags: input.tags },
        rationale: `Imported from ${input.sourceName} (${input.sourceId})`,
        trusted: true,
        markReviewed: true,
      });

      if (!result.doc) {
        throw new Error("the import proposal did not produce a document");
      }
      if (input.ownerId) {
        await db.from("docs").update({ owner_id: input.ownerId }).eq("id", result.doc.id);
      }
      return { id: result.doc.id };
    },

    async updateDoc(id, patch) {
      const { data, error } = await db
        .from("docs")
        .select("title, body_md, space_id, frontmatter")
        .eq("id", id)
        .single();
      if (error) throw error;

      const current = data as {
        title: string;
        body_md: string | null;
        space_id: string | null;
        frontmatter: { tags?: string[] } | null;
      };

      await proposeAgentDoc({
        workspaceId: target.workspaceId,
        agentKeyId: null,
        origin: "system",
        documentId: id,
        spaceId: patch.spaceId === undefined ? current.space_id : patch.spaceId,
        title: patch.title ?? current.title,
        bodyMd: patch.bodyMd ?? current.body_md ?? "",
        frontmatter: { tags: patch.tags ?? current.frontmatter?.tags ?? [] },
        rationale: "Re-imported",
        trusted: true,
        markReviewed: true,
      });

      if (patch.ownerId) {
        await db.from("docs").update({ owner_id: patch.ownerId }).eq("id", id);
      }
    },

    async placeDoc(docId, parentDocId) {
      // The tree's own function: it validates the move, keeps sibling positions
      // contiguous, and does not restamp `updated_at` — an import that
      // reshuffled every list by placing pages would be its own bug.
      const { error } = await db.rpc("move_doc", {
        p_doc_id: docId,
        p_parent_id: parentDocId,
        p_position: null,
      });
      if (error) throw error;
    },

    async uploadImage({ docId, filename, bytes, mimeType }) {
      const extension = DOC_IMAGE_EXTENSIONS[mimeType] ?? "bin";
      // Same shape as an interactive upload: the first two segments are what
      // the Storage policies read. The basename is derived from the source
      // filename rather than random so a re-import overwrites its own object
      // instead of leaving an orphan behind on every run.
      const safe = filename
        .toLowerCase()
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 60);
      const path = `${target.workspaceId}/${docId}/${safe || "image"}.${extension}`;

      await db.upload("doc-images", path, bytes, { contentType: mimeType, upsert: true });

      return docImageUrl(path);
    },

    async resolveSpace(spaceKey) {
      if (!spaceKey) return target.defaultSpaceId;
      return target.spaceMap[spaceKey] ?? target.defaultSpaceId;
    },

    async resolveAuthor(author) {
      if (!author) return null;
      return target.authorMap[author] ?? null;
    },
  };
}
