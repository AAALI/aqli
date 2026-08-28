/**
 * The contract an import source implements.
 *
 * Sources differ in how they store a page and nothing else: Confluence keeps
 * XHTML in a CSV out of a space export, Notion writes a folder of markdown,
 * someone else zips up their notes. What has to happen next is identical every
 * time — attachments uploaded, links resolved, authors mapped, placement
 * preserved, nothing lost quietly — so that lives in the pipeline and a source
 * only has to answer "what pages are in here?".
 *
 * A source yields pages one at a time because a real export does not fit in
 * memory: 1,361 pages of XHTML with their attachments is not a value you hold.
 */
import type { ConversionNote } from "@/lib/confluence/storage-to-md";

export type { ConversionNote };

export type SourceAttachment = {
  /** Stable within the export — used to key the upload and to spot a re-run. */
  id: string;
  filename: string;
  /** Null when the export does not say; the pipeline then guesses from the extension. */
  mimeType: string | null;
  read: () => Promise<Uint8Array>;
};

export type SourcePage = {
  /**
   * The source's own id for this page — a Confluence page id, a path inside a
   * zip. Import is idempotent on this: a second run updates rather than
   * duplicating, which is what makes a failed import safe to repeat.
   */
  sourceId: string;
  title: string;
  /** Markdown. Converting to it is the source's job. */
  bodyMd: string;
  /** The source's id for the parent page, if this is a sub-page. */
  parentSourceId: string | null;
  /** The source's own name for the space this page lived in. Mapped by config. */
  spaceKey: string | null;
  attachments: SourceAttachment[];
  /** The source's identifier for the author — a username, a key, an email. */
  author: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  labels: string[];
  /** What conversion could not represent. Everything here reaches the report. */
  notes: ConversionNote[];
};

export type ImportSource = {
  /** Recorded on every imported document, so a re-run can find its own work. */
  name: string;
  pages: () => AsyncIterable<SourcePage>;
};

/**
 * What the pipeline needs from the outside world.
 *
 * Injected rather than imported so the whole import can be exercised without a
 * database or a storage bucket — which is the only way the interesting cases
 * (a re-run, an attachment that fails to upload, an unmapped author) are cheap
 * enough to test at all.
 */
export type ImportDeps = {
  /** The document previously imported from this source page, if any. */
  findBySource: (sourceName: string, sourceId: string) => Promise<{ id: string } | null>;
  createDoc: (input: ImportDocInput) => Promise<{ id: string }>;
  /** A patch: only the fields present are written. */
  updateDoc: (id: string, input: ImportDocUpdate) => Promise<void>;
  /**
   * Place a document under its parent. Separate from `updateDoc` so the
   * placement pass cannot touch content: it runs after every page exists, and
   * a bug there would otherwise overwrite bodies that imported correctly.
   */
  placeDoc: (docId: string, parentDocId: string) => Promise<void>;
  /** Returns the path to reference the image by — never an expiring URL (C1). */
  uploadImage: (input: {
    docId: string;
    filename: string;
    bytes: Uint8Array;
    mimeType: string;
  }) => Promise<string>;
  /** Source space key → Aqli space id. Null means "no space", not "skip the page". */
  resolveSpace: (spaceKey: string | null) => Promise<string | null>;
  /** Source author → workspace member id, or null when nobody matches. */
  resolveAuthor: (author: string | null) => Promise<string | null>;
};

export type ImportDocInput = {
  workspaceId: string;
  spaceId: string | null;
  parentDocId: string | null;
  title: string;
  bodyMd: string;
  ownerId: string | null;
  tags: string[];
  sourceName: string;
  sourceId: string;
  /** The source's own timestamps, kept so history reads as it did before the move. */
  sourceUpdatedAt: string | null;
};

export type ImportDocUpdate = {
  title?: string;
  bodyMd?: string;
  spaceId?: string | null;
  ownerId?: string | null;
  tags?: string[];
};

/** One line of the import report, per page. */
export type PageOutcome = {
  sourceId: string;
  title: string;
  docId: string | null;
  status: "created" | "updated" | "failed";
  /** Attachments uploaded and referenced from the body. */
  images: string[];
  /**
   * Attachments that are not images. The image bucket takes PNG, JPEG, GIF and
   * WebP only, so a PDF or a spreadsheet has nowhere to go yet — it is listed
   * here, by name, for someone to place by hand. Nothing disappears silently.
   */
  unplacedAttachments: string[];
  /** Links to pages that were not in this export, left as they were. */
  unresolvedLinks: string[];
  /** The author string, when no member matched it. */
  unmappedAuthor: string | null;
  notes: ConversionNote[];
  error?: string;
};

export type ImportReport = {
  source: string;
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  pages: PageOutcome[];
};
