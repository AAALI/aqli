/**
 * A zip of markdown files.
 *
 * The cheapest source to support and the one that serves the most people: it is
 * what a Notion export becomes, what a git repo of docs already is, and what
 * Aqli's own export produces — which is what makes the export/import round trip
 * testable rather than rhetorical (F-6).
 *
 * Conventions, chosen because they are what real exports look like:
 *
 *   * a file's path is its identity, so a re-run updates rather than duplicates;
 *   * the top folder of a path is the space, when the archive has folders;
 *   * a folder and a file with the same name make the file the folder's parent
 *     page — `handbook/leave.md` is the parent of `handbook/leave/parental.md`;
 *   * `# Title` on the first line is the title, and is removed from the body,
 *     because Aqli renders the title itself and a document that repeats it
 *     reads as a mistake;
 *   * any other file (png, pdf) is an attachment of the pages that reference it.
 */
import { readZip, type ZipEntry } from "../zip";
import type { ImportSource, SourceAttachment, SourcePage } from "../types";

const MARKDOWN = /\.(md|markdown)$/i;

/** Front matter is metadata about the file, not part of the document. */
function stripFrontMatter(text: string): { body: string; tags: string[]; title: string | null } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { body: text, tags: [], title: null };

  const tags: string[] = [];
  let title: string | null = null;
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^(\w+):\s*(.*)$/.exec(line);
    if (!field) continue;
    const [, key, value] = field;
    if (key === "title") title = value.replace(/^["']|["']$/g, "");
    if (key === "tags") {
      tags.push(
        ...value
          .replace(/^\[|\]$/g, "")
          .split(",")
          .map((t) => t.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean),
      );
    }
  }
  return { body: text.slice(match[0].length), tags, title };
}

/** `handbook/parental-leave.md` → "Parental leave", when nothing better is available. */
function titleFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  const stem = base.replace(MARKDOWN, "").replace(/[-_]+/g, " ").trim();
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

function titleFromHeading(body: string): { title: string | null; body: string } {
  const match = /^\s*#\s+(.+?)\s*\r?\n+/.exec(body);
  if (!match) return { title: null, body };
  return { title: match[1].trim(), body: body.slice(match[0].length) };
}

/**
 * The page a file hangs under: the same path without its extension, if a
 * document lives there. `a/b/c.md` looks for `a/b.md`, then `a.md`.
 */
function parentOf(path: string, pages: Set<string>): string | null {
  const parts = path.replace(MARKDOWN, "").split("/");
  for (let depth = parts.length - 1; depth > 0; depth--) {
    for (const extension of [".md", ".markdown"]) {
      const candidate = `${parts.slice(0, depth).join("/")}${extension}`;
      if (candidate !== path && pages.has(candidate)) return candidate;
    }
  }
  return null;
}

/** The first folder, when the archive has any — "handbook/leave.md" is in Handbook. */
function spaceOf(path: string): string | null {
  const parts = path.split("/");
  return parts.length > 1 ? parts[0] : null;
}

export function markdownZipSource(archive: Uint8Array, name = "markdown-zip"): ImportSource {
  const entries = readZip(archive);
  const docs = entries.filter((e) => MARKDOWN.test(e.path));
  const files = entries.filter((e) => !MARKDOWN.test(e.path));
  const paths = new Set(docs.map((d) => d.path));

  return {
    name,
    pages: async function* (): AsyncIterable<SourcePage> {
      for (const entry of docs) {
        yield await toPage(entry, paths, files);
      }
    },
  };
}

async function toPage(
  entry: ZipEntry,
  paths: Set<string>,
  files: ZipEntry[],
): Promise<SourcePage> {
  const raw = new TextDecoder().decode(await entry.read());
  const front = stripFrontMatter(raw);
  const heading = titleFromHeading(front.body);

  // Attachments are matched by what the body actually references, so a shared
  // images folder is not uploaded once per page that ignores it.
  const referenced = new Set<string>();
  for (const match of front.body.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
    referenced.add(match[1]);
  }

  const attachments: SourceAttachment[] = files
    .filter((file) => {
      const base = file.path.split("/").pop() ?? file.path;
      return [...referenced].some((ref) => {
        const refBase = ref.split("/").pop();
        return ref === file.path || refBase === base;
      });
    })
    .map((file) => ({
      id: file.path,
      filename: file.path.split("/").pop() ?? file.path,
      mimeType: null,
      read: file.read,
    }));

  return {
    sourceId: entry.path,
    title: heading.title ?? front.title ?? titleFromPath(entry.path),
    bodyMd: heading.body.trim(),
    parentSourceId: parentOf(entry.path, paths),
    spaceKey: spaceOf(entry.path),
    attachments,
    author: null,
    createdAt: null,
    updatedAt: null,
    labels: front.tags,
    notes: [],
  };
}
