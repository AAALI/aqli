/**
 * Laying a workspace out as files.
 *
 * The shape of the archive is the whole point. An export nobody can read
 * without Aqli is a backup, not an exit door — so the tree is folders, the
 * documents are markdown, the images sit beside them, and the links between
 * them are relative. It opens in any editor, and it imports back through the
 * markdown source (F-1), which is what makes "you can leave" a fact rather than
 * a claim.
 *
 * Pure, and separate from the database: what goes where and what the front
 * matter says are the parts worth asserting, and they should not need a
 * workspace to assert.
 */
import type { ZipFile } from "./zip-writer";

export type ExportDoc = {
  id: string;
  title: string;
  bodyMd: string;
  status: string;
  type: string;
  spaceName: string | null;
  spaceSlug: string | null;
  parentDocId: string | null;
  position: number;
  tags: string[];
  currentRevisionId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ExportImage = {
  /** The object path as it appears in `/api/images/<path>`. */
  objectPath: string;
  /** Read lazily: a workspace's images are the bulk of an export and must not be held at once. */
  read: () => Promise<Uint8Array>;
};

/** A file name that survives every filesystem people will unzip this on. */
export function fileSlug(title: string, fallback: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
  return slug || fallback;
}

/**
 * `handbook/leave/parental-leave.md`.
 *
 * A page with sub-pages becomes a file *and* a folder of the same name, which
 * is the convention the markdown importer reads back — so a tree exported here
 * comes home as a tree.
 */
export function docPaths(docs: ExportDoc[]): Map<string, string> {
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  const paths = new Map<string, string>();

  // Written as a loop rather than recursion so a cycle — which the database
  // forbids, but an export should not hang on regardless — is bounded.
  for (const doc of docs) {
    const chain: string[] = [];
    let current: ExportDoc | undefined = doc;
    let hops = 0;
    while (current && hops++ < 64) {
      chain.unshift(fileSlug(current.title, current.id));
      current = current.parentDocId ? byId.get(current.parentDocId) : undefined;
    }
    const space = doc.spaceSlug ?? "no-space";
    paths.set(doc.id, `${space}/${chain.join("/")}.md`);
  }

  return paths;
}

function frontMatter(doc: ExportDoc, parentPath: string | null): string {
  const lines = [
    "---",
    `title: ${JSON.stringify(doc.title)}`,
    `status: ${doc.status}`,
    `type: ${doc.type}`,
  ];
  if (doc.spaceName) lines.push(`space: ${JSON.stringify(doc.spaceName)}`);
  if (parentPath) lines.push(`parent: ${JSON.stringify(parentPath)}`);
  if (doc.tags.length > 0) lines.push(`tags: [${doc.tags.map((t) => JSON.stringify(t)).join(", ")}]`);
  // The revision this file is a copy of, so an export can be traced back to a
  // point in the document's history rather than just a date.
  if (doc.currentRevisionId) lines.push(`revision: ${doc.currentRevisionId}`);
  if (doc.createdAt) lines.push(`created: ${doc.createdAt}`);
  if (doc.updatedAt) lines.push(`updated: ${doc.updatedAt}`);
  lines.push(`aqli_id: ${doc.id}`);
  lines.push("---", "");
  return lines.join("\n");
}

/** How many `../` it takes to get from a document back to the archive root. */
function upTo(path: string): string {
  const depth = path.split("/").length - 1;
  return "../".repeat(depth);
}

/**
 * Repoint `/api/images/<path>` at the copy inside the archive.
 *
 * Without this the export reads correctly only while signed in to the instance
 * it came from, which is the opposite of the point.
 */
export function rewriteImageLinks(body: string, docPath: string, images: Set<string>): string {
  return body.replace(
    /!\[([^\]]*)\]\(\/api\/images\/([^)\s]+)([^)]*)\)/g,
    (match, alt: string, objectPath: string, rest: string) => {
      if (!images.has(objectPath)) return match;
      return `![${alt}](${upTo(docPath)}_images/${objectPath}${rest})`;
    },
  );
}

/**
 * Every file in the export, in a fixed order.
 *
 * Sorted by path, so two exports of the same content produce the same archive —
 * the ordering is as much a part of determinism as the fixed timestamps are.
 *
 * Image bytes are read as each entry is reached rather than up front: they are
 * the bulk of a real export, and holding a workspace's screenshots in memory to
 * decide what order to write them in is how an export dies on a big workspace.
 */
export async function* exportFiles(
  docs: ExportDoc[],
  images: ExportImage[],
): AsyncGenerator<ZipFile> {
  const encoder = new TextEncoder();
  const paths = docPaths(docs);
  const imagePaths = new Set(images.map((image) => image.objectPath));
  const byId = new Map(docs.map((doc) => [doc.id, doc]));

  type Planned =
    | { path: string; bytes: Uint8Array }
    | { path: string; read: () => Promise<Uint8Array> };

  const planned: Planned[] = [];

  for (const doc of docs) {
    const path = paths.get(doc.id)!;
    const parent = doc.parentDocId ? byId.get(doc.parentDocId) : undefined;
    const body = rewriteImageLinks(doc.bodyMd ?? "", path, imagePaths);
    planned.push({
      path,
      bytes: encoder.encode(
        `${frontMatter(doc, parent ? paths.get(parent.id)! : null)}# ${doc.title}\n\n${body.trim()}\n`,
      ),
    });
  }

  for (const image of images) {
    planned.push({ path: `_images/${image.objectPath}`, read: image.read });
  }

  planned.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  for (const file of planned) {
    yield "bytes" in file ? { path: file.path, bytes: file.bytes } : { path: file.path, bytes: await file.read() };
  }
}
