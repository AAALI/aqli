/**
 * The import pipeline: everything that happens to a page after a source has
 * turned it into markdown.
 *
 * Sources differ only in how they store a page. What has to happen next is the
 * same every time, and it is the part that goes wrong: attachments that become
 * expiring links, cross-references that die, authors that turn into broken
 * mentions, a re-run that duplicates the corpus, a macro that vanishes without
 * anybody noticing. So it lives here once, and a new source is a parser.
 *
 * The order matters and is not arbitrary:
 *
 *   1. create or update the document, so attachments have somewhere to live;
 *   2. upload attachments and repoint the body at them;
 *   3. resolve internal links, once every page has an id — which is why this
 *      is a second phase rather than part of the first;
 *   4. place pages under their parents, for the same reason;
 *   5. report everything that did not survive, per page.
 *
 * Nothing is dropped quietly. A macro with no handler, an attachment that is
 * not an image, a link to a page outside the export, an author nobody matched:
 * each one lands in the report against the page it came from.
 */
import type {
  ImportDeps,
  ImportReport,
  ImportSource,
  PageOutcome,
  SourceAttachment,
  SourcePage,
} from "./types";

export type ImportOptions = {
  workspaceId: string;
  /** Convert a document id into the href a rewritten link should point at. */
  docHref: (docId: string) => string;
  /** Report what would happen and write nothing. */
  dryRun?: boolean;
  onProgress?: (outcome: PageOutcome) => void;
};

/** The image types the doc-images bucket accepts. Anything else is reported, not uploaded. */
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function imageMimeType(attachment: SourceAttachment): string | null {
  if (attachment.mimeType && Object.values(IMAGE_TYPES).includes(attachment.mimeType)) {
    return attachment.mimeType;
  }
  const extension = attachment.filename.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_TYPES[extension] ?? null;
}

/** Titles become link targets; the Confluence converter emits `/docs/<slugified title>`. */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** `handbook/leave/parental.md` + `../expenses.md` → `handbook/expenses.md`. */
function resolveRelative(from: string, target: string): string {
  const base = from.split("/").slice(0, -1);
  const out: string[] = [...base];
  for (const part of target.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

type PageIndex = {
  /** Source id → document id. */
  docs: Map<string, string>;
  /** Slugified title → source id, for sources that link by title. */
  byTitle: Map<string, string>;
};

/**
 * Markdown links and images, ignoring escaped brackets.
 *
 * A parser would be the careful answer, but the body is markdown by the time it
 * gets here and rewriting it as text keeps everything else about it identical —
 * which is what C1 asks for: the import must not quietly renormalise documents
 * on the way in.
 */
const LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g;

function rewriteImages(
  body: string,
  attachments: SourceAttachment[],
  uploaded: Map<string, string>,
): string {
  if (attachments.length === 0) return body;
  return body.replace(LINK, (match, bang: string, label: string, target: string, title = "") => {
    if (bang !== "!") return match;
    const path = uploaded.get(target) ?? uploaded.get(target.split("/").pop() ?? "");
    return path ? `![${label}](${path}${title})` : match;
  });
}

function rewriteLinks(
  body: string,
  page: SourcePage,
  index: PageIndex,
  docHref: (docId: string) => string,
  unresolved: string[],
): string {
  return body.replace(LINK, (match, bang: string, label: string, target: string, title = "") => {
    if (bang === "!") return match;
    // Anything with a scheme or a mail link is already pointing somewhere real.
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) return match;

    const candidates = [
      target,
      target.replace(/^\/docs\//, ""),
      resolveRelative(page.sourceId, target),
    ];

    for (const candidate of candidates) {
      const direct = index.docs.get(candidate);
      if (direct) return `[${label}](${docHref(direct)}${title})`;

      const byTitle = index.byTitle.get(candidate);
      const viaTitle = byTitle ? index.docs.get(byTitle) : undefined;
      if (viaTitle) return `[${label}](${docHref(viaTitle)}${title})`;
    }

    // A page that was not in this export. Leaving a dead link would look
    // imported and be broken; the label survives as text and the report says
    // where it pointed.
    if (target.startsWith("/docs/") || target.endsWith(".md") || !target.includes("/")) {
      unresolved.push(target);
      return label || target;
    }
    return match;
  });
}

export async function runImport(
  source: ImportSource,
  deps: ImportDeps,
  options: ImportOptions,
): Promise<ImportReport> {
  const startedAt = new Date().toISOString();
  const dryRun = options.dryRun ?? false;

  const index: PageIndex = { docs: new Map(), byTitle: new Map() };
  const outcomes: PageOutcome[] = [];
  /** Bodies still holding link placeholders, kept until every page has an id. */
  const pendingLinks: { page: SourcePage; docId: string; body: string; outcome: PageOutcome }[] = [];
  /** Placement, applied once every parent exists. */
  const placements: { docId: string; parentSourceId: string; outcome: PageOutcome }[] = [];

  for await (const page of source.pages()) {
    const outcome: PageOutcome = {
      sourceId: page.sourceId,
      title: page.title,
      docId: null,
      status: "created",
      images: [],
      unplacedAttachments: [],
      unresolvedLinks: [],
      unmappedAuthor: null,
      notes: page.notes,
    };

    try {
      index.byTitle.set(slugifyTitle(page.title), page.sourceId);

      const [spaceId, ownerId] = await Promise.all([
        deps.resolveSpace(page.spaceKey),
        deps.resolveAuthor(page.author),
      ]);
      if (page.author && !ownerId) outcome.unmappedAuthor = page.author;

      // Idempotency. A second run of an import that died half way through
      // should finish it, not build a second copy of everything.
      const existing = await deps.findBySource(source.name, page.sourceId);
      outcome.status = existing ? "updated" : "created";

      let docId = existing?.id ?? null;
      if (!dryRun) {
        if (existing) {
          await deps.updateDoc(existing.id, {
            title: page.title,
            bodyMd: page.bodyMd,
            spaceId,
            ownerId,
            tags: page.labels,
          });
        } else {
          const created = await deps.createDoc({
            workspaceId: options.workspaceId,
            spaceId,
            parentDocId: null,
            title: page.title,
            bodyMd: page.bodyMd,
            ownerId,
            tags: page.labels,
            sourceName: source.name,
            sourceId: page.sourceId,
            sourceUpdatedAt: page.updatedAt,
          });
          docId = created.id;
        }
      }

      if (docId) index.docs.set(page.sourceId, docId);
      outcome.docId = docId;

      // --- attachments ----------------------------------------------------
      const uploaded = new Map<string, string>();
      for (const attachment of page.attachments) {
        const mimeType = imageMimeType(attachment);
        if (!mimeType) {
          // The bucket holds images only. A PDF or a spreadsheet is named in
          // the report for someone to place by hand rather than dropped.
          outcome.unplacedAttachments.push(attachment.filename);
          continue;
        }
        if (dryRun || !docId) {
          outcome.images.push(attachment.filename);
          continue;
        }
        const path = await deps.uploadImage({
          docId,
          filename: attachment.filename,
          bytes: await attachment.read(),
          mimeType,
        });
        uploaded.set(attachment.id, path);
        uploaded.set(attachment.filename, path);
        outcome.images.push(attachment.filename);
      }

      const withImages = rewriteImages(page.bodyMd, page.attachments, uploaded);

      // --- links ------------------------------------------------------------
      // Deferred: a link can point at a page this export has not reached yet.
      if (LINK.test(withImages)) {
        LINK.lastIndex = 0;
        if (docId) pendingLinks.push({ page, docId, body: withImages, outcome });
        else if (dryRun) {
          rewriteLinks(withImages, page, index, options.docHref, outcome.unresolvedLinks);
        }
      } else if (!dryRun && docId && withImages !== page.bodyMd) {
        await deps.updateDoc(docId, { bodyMd: withImages });
      }

      if (page.parentSourceId && docId) {
        placements.push({ docId, parentSourceId: page.parentSourceId, outcome });
      }
    } catch (err) {
      outcome.status = "failed";
      outcome.error = err instanceof Error ? err.message : String(err);
    }

    outcomes.push(outcome);
    options.onProgress?.(outcome);
  }

  // --- phase 2: links, now that every page has an id ------------------------
  for (const pending of pendingLinks) {
    try {
      const body = rewriteLinks(
        pending.body,
        pending.page,
        index,
        options.docHref,
        pending.outcome.unresolvedLinks,
      );
      if (!dryRun && body !== pending.page.bodyMd) {
        await deps.updateDoc(pending.docId, { bodyMd: body });
      }
    } catch (err) {
      pending.outcome.status = "failed";
      pending.outcome.error = err instanceof Error ? err.message : String(err);
    }
  }

  // --- phase 3: placement ---------------------------------------------------
  for (const placement of placements) {
    const parentDocId = index.docs.get(placement.parentSourceId);
    if (!parentDocId) {
      // The parent was not in this export. A root page is navigable; a page
      // pointing at nothing is not.
      placement.outcome.notes = [
        ...placement.outcome.notes,
        { kind: "dropped", name: `parent page ${placement.parentSourceId} was not in this export` },
      ];
      continue;
    }
    if (dryRun) continue;
    try {
      await deps.placeDoc(placement.docId, parentDocId);
    } catch (err) {
      placement.outcome.notes = [
        ...placement.outcome.notes,
        {
          kind: "dropped",
          name: `could not place under ${placement.parentSourceId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      ];
    }
  }

  return {
    source: source.name,
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun,
    pages: outcomes,
  };
}
