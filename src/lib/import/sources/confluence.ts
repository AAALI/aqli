/**
 * A Confluence space export.
 *
 * The conversion itself already exists — `lib/confluence/storage-to-md.ts`,
 * built against the macro census of a real 1,361-page corpus, and measured by
 * `pnpm confluence:fidelity`. What was missing was everything around it: which
 * pages exist, what they are called, which page is whose parent, and where the
 * attachments are. That is what this reads.
 *
 * **Column names are detected, not assumed.** The CSV layout of a space export
 * differs between Confluence versions, so every field below is looked up from
 * the header against a list of the names that version has used. A column that
 * is absent degrades one field — a missing title falls back to the page id, a
 * missing parent column means a flat import — rather than failing the run. The
 * import report says which columns were found, because "why is my tree flat?"
 * should be answerable without reading this file.
 */
import { confluenceStorageToMarkdown } from "@/lib/confluence/storage-to-md";
import type { ImportSource, SourceAttachment, SourcePage } from "../types";

/**
 * An unpacked export, however it is being read — a directory on disk or a zip
 * held in memory. Both shapes exist because the CLI has a filesystem and the
 * upload route does not.
 */
export type ExportFiles = {
  /** Every path in the export, relative to its root. */
  paths: string[];
  rows: (path: string) => AsyncIterable<string[]>;
  readBytes: (path: string) => Promise<Uint8Array>;
};

/** Candidate column names, in the order they are preferred. */
const COLUMNS = {
  id: ["contentid", "id"],
  title: ["title"],
  parent: ["parentid", "parent_id", "parentcontentid"],
  space: ["spacekey", "space", "spaceid"],
  body: ["body"],
  author: ["creator", "creatorname", "username", "author", "lastmodifier"],
  updated: ["lastmoddate", "lastmodificationdate", "modified"],
  created: ["creationdate", "created"],
  type: ["contenttype", "type"],
  status: ["contentstatus", "status"],
  attachmentFor: ["contentid", "pageid", "containerid"],
  filename: ["title", "filename", "name"],
} as const;

function indexOfColumn(header: string[], names: readonly string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const at = lower.indexOf(name);
    if (at !== -1) return at;
  }
  return -1;
}

const at = (row: string[], column: number): string | null =>
  column === -1 ? null : (row[column]?.trim() || null);

/** The CSVs live at the export root in some versions and under `entities/` in others. */
function findCsv(paths: string[], name: string): string | null {
  const wanted = name.toLowerCase();
  return (
    paths.find((p) => p.toLowerCase() === wanted) ??
    paths.find((p) => p.toLowerCase().endsWith(`/${wanted}`)) ??
    null
  );
}

type PageMeta = {
  title: string | null;
  parentId: string | null;
  spaceKey: string | null;
  author: string | null;
  created: string | null;
  updated: string | null;
};

async function readPageMetadata(
  files: ExportFiles,
): Promise<{ meta: Map<string, PageMeta>; columns: string[] }> {
  const path = findCsv(files.paths, "content.csv") ?? findCsv(files.paths, "pages.csv");
  const meta = new Map<string, PageMeta>();
  if (!path) return { meta, columns: [] };

  let header: string[] | null = null;
  let cols = { id: -1, title: -1, parent: -1, space: -1, author: -1, created: -1, updated: -1, type: -1, status: -1 };

  for await (const row of files.rows(path)) {
    if (!header) {
      header = row;
      cols = {
        id: indexOfColumn(row, COLUMNS.id),
        title: indexOfColumn(row, COLUMNS.title),
        parent: indexOfColumn(row, COLUMNS.parent),
        space: indexOfColumn(row, COLUMNS.space),
        author: indexOfColumn(row, COLUMNS.author),
        created: indexOfColumn(row, COLUMNS.created),
        updated: indexOfColumn(row, COLUMNS.updated),
        type: indexOfColumn(row, COLUMNS.type),
        status: indexOfColumn(row, COLUMNS.status),
      };
      continue;
    }

    const id = at(row, cols.id);
    if (!id) continue;

    // An export carries blog posts, comments and old drafts alongside pages.
    // Importing a comment as a document is worse than not importing it.
    const type = at(row, cols.type);
    if (type && type.toLowerCase() !== "page") continue;
    const status = at(row, cols.status);
    if (status && status.toLowerCase() !== "current") continue;

    meta.set(id, {
      title: at(row, cols.title),
      parentId: at(row, cols.parent),
      spaceKey: at(row, cols.space),
      author: at(row, cols.author),
      created: at(row, cols.created),
      updated: at(row, cols.updated),
    });
  }

  const found = Object.entries(cols)
    .filter(([, index]) => index !== -1)
    .map(([name]) => name);
  return { meta, columns: found };
}

/**
 * Attachments, keyed by the page they belong to.
 *
 * The export stores them under `attachments/<contentId>/…`, and the file on
 * disk is usually named by version rather than by what a person called it. When
 * `attachments.csv` is present it carries the real names; when it is not, the
 * path is the best available answer and the body's own reference is matched on
 * basename.
 */
async function readAttachments(files: ExportFiles): Promise<Map<string, SourceAttachment[]>> {
  const byPage = new Map<string, SourceAttachment[]>();
  const names = new Map<string, string>();

  const csv = findCsv(files.paths, "attachments.csv");
  if (csv) {
    let header: string[] | null = null;
    let idColumn = -1;
    let nameColumn = -1;
    for await (const row of files.rows(csv)) {
      if (!header) {
        header = row;
        idColumn = indexOfColumn(row, COLUMNS.id);
        nameColumn = indexOfColumn(row, COLUMNS.filename);
        continue;
      }
      const id = at(row, idColumn);
      const name = at(row, nameColumn);
      if (id && name) names.set(id, name);
    }
  }

  for (const path of files.paths) {
    const match = /(?:^|\/)attachments\/([^/]+)\/(.+)$/.exec(path);
    if (!match) continue;
    const [, pageId, rest] = match;
    const attachmentId = rest.split("/")[0];
    const filename = names.get(attachmentId) ?? rest.split("/").pop() ?? attachmentId;

    const list = byPage.get(pageId) ?? [];
    list.push({
      id: attachmentId,
      filename,
      mimeType: null,
      read: () => files.readBytes(path),
    });
    byPage.set(pageId, list);
  }

  return byPage;
}

export type ConfluenceSourceInfo = {
  /** Which metadata columns were found, so the report can explain a flat import. */
  columns: string[];
  pageCount: number;
};

export async function confluenceSource(
  files: ExportFiles,
  name = "confluence",
): Promise<ImportSource & { info: ConfluenceSourceInfo }> {
  const bodyPath = findCsv(files.paths, "bodycontent.csv");
  if (!bodyPath) {
    throw new Error(
      "no bodycontent.csv in this export — is it a Confluence space export, unzipped?",
    );
  }

  const [{ meta, columns }, attachments] = await Promise.all([
    readPageMetadata(files),
    readAttachments(files),
  ]);

  return {
    name,
    info: { columns, pageCount: meta.size },
    pages: async function* (): AsyncIterable<SourcePage> {
      let header: string[] | null = null;
      let idColumn = -1;
      let bodyColumn = -1;

      for await (const row of files.rows(bodyPath)) {
        if (!header) {
          header = row;
          idColumn = indexOfColumn(row, COLUMNS.id);
          bodyColumn = indexOfColumn(row, COLUMNS.body);
          if (idColumn === -1 || bodyColumn === -1) {
            throw new Error(
              `bodycontent.csv has no recognisable id and body columns (header: ${row.join(", ")})`,
            );
          }
          continue;
        }

        const id = at(row, idColumn);
        const storage = row[bodyColumn];
        if (!id || !storage) continue;

        // With metadata present, only the rows it lists as current pages are
        // imported — bodies also exist for comments and superseded versions.
        const page = meta.get(id);
        if (meta.size > 0 && !page) continue;

        const converted = confluenceStorageToMarkdown(storage);

        yield {
          sourceId: id,
          title: page?.title ?? `Untitled ${id}`,
          bodyMd: converted.markdown,
          parentSourceId: page?.parentId ?? null,
          spaceKey: page?.spaceKey ?? null,
          attachments: attachments.get(id) ?? [],
          author: page?.author ?? null,
          createdAt: page?.created ?? null,
          updatedAt: page?.updated ?? null,
          labels: [],
          notes: converted.notes,
        };
      }
    },
  };
}
