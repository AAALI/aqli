import { describe, it, expect, vi } from "vitest";
import { deflateRawSync } from "node:zlib";
import { markdownZipSource } from "../sources/markdown-zip";
import { runImport } from "../pipeline";
import { renderImportReport } from "../report";
import type { ImportDeps } from "../types";

function buildZip(files: { path: string; body: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.path);
    const raw = encoder.encode(file.body);
    const body = new Uint8Array(deflateRawSync(Buffer.from(raw)));
    const local = new Uint8Array(30 + name.length + body.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 8, true);
    lv.setUint32(18, body.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(body, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(20, body.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A workspace in memory: what was created, with what body, under what parent. */
function fakeWorkspace() {
  const docs = new Map<string, { title: string; bodyMd: string; parent: string | null; spaceId: string | null }>();
  const bySource = new Map<string, string>();
  let next = 0;

  const deps: ImportDeps = {
    findBySource: async (source, id) => {
      const docId = bySource.get(`${source}:${id}`);
      return docId ? { id: docId } : null;
    },
    createDoc: async (input) => {
      const id = `doc-${++next}`;
      docs.set(id, { title: input.title, bodyMd: input.bodyMd, parent: null, spaceId: input.spaceId });
      bySource.set(`${input.sourceName}:${input.sourceId}`, id);
      return { id };
    },
    updateDoc: async (id, patch) => {
      const doc = docs.get(id);
      if (!doc) throw new Error("no such document");
      docs.set(id, {
        ...doc,
        title: patch.title ?? doc.title,
        bodyMd: patch.bodyMd ?? doc.bodyMd,
        spaceId: patch.spaceId === undefined ? doc.spaceId : patch.spaceId,
      });
    },
    placeDoc: async (docId, parentDocId) => {
      const doc = docs.get(docId);
      if (doc) docs.set(docId, { ...doc, parent: parentDocId });
    },
    uploadImage: async ({ docId, filename }) => `/api/images/ws/${docId}/${filename}`,
    resolveSpace: async (key) => (key ? `space-${key.toLowerCase()}` : null),
    resolveAuthor: async () => null,
  };

  return { deps, docs, bySource };
}

const ARCHIVE = buildZip([
  {
    path: "Handbook/leave.md",
    body: "# Leave\n\nAll leave policies. See [expenses](../Finance/expenses.md).\n",
  },
  {
    path: "Handbook/leave/parental.md",
    body: "# Parental leave\n\nSix weeks.\n\n![The form](images/form.png)\n",
  },
  { path: "Finance/expenses.md", body: "# Expenses\n\nSubmit within 30 days.\n" },
  { path: "Handbook/images/form.png", body: "png-bytes" },
]);

const options = {
  workspaceId: "ws1",
  docHref: (id: string) => `/w/acme/docs/${id}`,
};

describe("a zip of markdown, end to end", () => {
  it("imports the pages, the tree, the images and the cross-links", async () => {
    const { deps, docs } = fakeWorkspace();
    const report = await runImport(markdownZipSource(ARCHIVE), deps, options);

    expect(report.pages).toHaveLength(3);
    expect(report.pages.every((p) => p.status === "created")).toBe(true);

    const byTitle = new Map([...docs.entries()].map(([id, doc]) => [doc.title, { id, ...doc }]));

    // Titles came from the headings, and the headings are gone from the bodies.
    expect([...byTitle.keys()].sort()).toEqual(["Expenses", "Leave", "Parental leave"]);
    expect(byTitle.get("Leave")!.bodyMd.startsWith("All leave policies")).toBe(true);

    // The tree survived: leave.md is the parent of the leave/ folder's pages.
    expect(byTitle.get("Parental leave")!.parent).toBe(byTitle.get("Leave")!.id);
    expect(byTitle.get("Leave")!.parent).toBeNull();

    // Spaces came from the top folder.
    expect(byTitle.get("Leave")!.spaceId).toBe("space-handbook");
    expect(byTitle.get("Expenses")!.spaceId).toBe("space-finance");

    // The image points at the stored copy, not at a path inside the zip.
    expect(byTitle.get("Parental leave")!.bodyMd).toContain(
      `![The form](/api/images/ws/${byTitle.get("Parental leave")!.id}/form.png)`,
    );

    // The cross-reference points at the document the other page became.
    expect(byTitle.get("Leave")!.bodyMd).toContain(
      `[expenses](/w/acme/docs/${byTitle.get("Expenses")!.id})`,
    );
  });

  it("re-importing the same archive changes nothing and creates nothing", async () => {
    // The acceptance criterion in full: a second run is safe.
    const { deps, docs } = fakeWorkspace();
    await runImport(markdownZipSource(ARCHIVE), deps, options);

    const before = new Map([...docs.entries()].map(([id, doc]) => [id, { ...doc }]));
    const createSpy = vi.spyOn(deps, "createDoc");

    const second = await runImport(markdownZipSource(ARCHIVE), deps, options);

    expect(createSpy).not.toHaveBeenCalled();
    expect(second.pages.every((p) => p.status === "updated")).toBe(true);
    expect(docs.size).toBe(before.size);
    for (const [id, doc] of docs) {
      expect(doc.title).toBe(before.get(id)!.title);
      expect(doc.bodyMd).toBe(before.get(id)!.bodyMd);
      expect(doc.parent).toBe(before.get(id)!.parent);
    }
  });

  it("produces a report naming every page", async () => {
    const { deps } = fakeWorkspace();
    const report = await runImport(markdownZipSource(ARCHIVE), deps, options);
    const markdown = renderImportReport(report, options.docHref);

    expect(markdown).toContain("| Pages | 3 |");
    for (const title of ["Leave", "Parental leave", "Expenses"]) {
      expect(markdown).toContain(title);
    }
  });
});
