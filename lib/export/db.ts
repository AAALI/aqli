/**
 * The workspace, as files.
 *
 * Reads what an export needs and hands it to the layout module, which decides
 * where everything goes. Split that way for the same reason the importer is:
 * the interesting rules — paths, front matter, relative image links — are worth
 * asserting without a database, and the query is not.
 */
import { scoped } from "@/lib/db";
import type { ExportDoc, ExportImage } from "./workspace";
import { exportFiles } from "./workspace";
import type { ZipFile } from "./zip-writer";

type DocRow = {
  id: string;
  title: string;
  body_md: string | null;
  status: string;
  type: string;
  parent_doc_id: string | null;
  position: number;
  frontmatter: { tags?: string[] } | null;
  current_revision_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  space: { name: string; slug: string } | null;
};

/** Every `/api/images/<path>` a body references. */
export function referencedImages(bodies: string[]): string[] {
  const paths = new Set<string>();
  for (const body of bodies) {
    for (const match of body.matchAll(/\/api\/images\/([^)\s"']+)/g)) {
      paths.add(match[1]);
    }
  }
  return [...paths].sort();
}

export async function workspaceExport(workspaceId: string): Promise<AsyncGenerator<ZipFile>> {
  const db = scoped(workspaceId);

  const { data, error } = await db
    .from("docs")
    .select(
      "id, title, body_md, status, type, parent_doc_id, position, frontmatter, current_revision_id, created_at, updated_at, space:spaces(name, slug)",
    )
    // Ordered so the export is stable before the layout even sorts it.
    .order("id", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as unknown as DocRow[];

  const docs: ExportDoc[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    bodyMd: row.body_md ?? "",
    status: row.status,
    type: row.type,
    spaceName: row.space?.name ?? null,
    spaceSlug: row.space?.slug ?? null,
    parentDocId: row.parent_doc_id,
    position: row.position,
    tags: row.frontmatter?.tags ?? [],
    currentRevisionId: row.current_revision_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const images: ExportImage[] = referencedImages(docs.map((doc) => doc.bodyMd)).map((objectPath) => ({
    objectPath,
    // Read when the archive reaches it. An image that has gone missing from
    // storage yields an empty file rather than failing the export: a person
    // mid-migration needs the other 400 documents more than they need this to
    // be atomic, and the empty file is visible.
    read: async () => {
      try {
        return await db.download("doc-images", objectPath);
      } catch {
        return new Uint8Array();
      }
    },
  }));

  return exportFiles(docs, images);
}
