import { describe, it, expect } from "vitest";
import { exportFiles, type ExportDoc } from "../workspace";
import { zipBytes } from "../zip-writer";
import { markdownZipSource } from "@/lib/import/sources/markdown-zip";
import { runImport } from "@/lib/import/pipeline";
import type { ImportDeps } from "@/lib/import/types";

/**
 * The export goes back in through the importer.
 *
 * This is the test that makes "markdown is canonical, so you can leave" a fact
 * instead of a claim, and it is why the export lays files out the way the
 * importer reads them. If either side drifts, this fails — which is the point:
 * the exit door is checked by the same run as everything else.
 */
function fakeWorkspace() {
  const docs = new Map<string, { title: string; bodyMd: string; parent: string | null; space: string | null }>();
  const bySource = new Map<string, string>();
  let next = 0;

  const deps: ImportDeps = {
    findBySource: async (source, id) => {
      const found = bySource.get(`${source}:${id}`);
      return found ? { id: found } : null;
    },
    createDoc: async (input) => {
      const id = `imported-${++next}`;
      docs.set(id, { title: input.title, bodyMd: input.bodyMd, parent: null, space: input.spaceId });
      bySource.set(`${input.sourceName}:${input.sourceId}`, id);
      return { id };
    },
    updateDoc: async (id, patch) => {
      const doc = docs.get(id)!;
      docs.set(id, { ...doc, title: patch.title ?? doc.title, bodyMd: patch.bodyMd ?? doc.bodyMd });
    },
    placeDoc: async (id, parent) => {
      docs.set(id, { ...docs.get(id)!, parent });
    },
    uploadImage: async ({ docId, filename }) => `/api/images/ws1/${docId}/${filename}`,
    resolveSpace: async (key) => key,
    resolveAuthor: async () => null,
  };

  return { deps, docs };
}

function doc(over: Partial<ExportDoc> & { id: string; title: string }): ExportDoc {
  return {
    bodyMd: "Body",
    status: "approved",
    type: "general",
    spaceName: "Handbook",
    spaceSlug: "handbook",
    parentDocId: null,
    position: 0,
    tags: [],
    currentRevisionId: null,
    createdAt: null,
    updatedAt: null,
    ...over,
  };
}

const WORKSPACE: ExportDoc[] = [
  doc({ id: "d1", title: "Leave", bodyMd: "All leave policies live here." }),
  doc({
    id: "d2",
    title: "Parental leave",
    parentDocId: "d1",
    bodyMd: "Six weeks.\n\n![The form](/api/images/ws1/d2/form.png)",
    tags: ["hr"],
  }),
  doc({
    id: "d3",
    title: "Expenses",
    spaceName: "Finance",
    spaceSlug: "finance",
    bodyMd: "Submit within 30 days.",
  }),
];

const IMAGES = [{ objectPath: "ws1/d2/form.png", read: async () => new Uint8Array([137, 80, 78, 71]) }];

describe("export → import", () => {
  it("brings back every document, its title and its body", async () => {
    const archive = await zipBytes(exportFiles(WORKSPACE, IMAGES));
    const { deps, docs } = fakeWorkspace();

    const report = await runImport(markdownZipSource(archive), deps, {
      workspaceId: "ws2",
      docHref: (id) => `/w/new/docs/${id}`,
    });

    expect(report.pages.filter((p) => p.status === "failed")).toEqual([]);
    const titles = [...docs.values()].map((d) => d.title).sort();
    expect(titles).toEqual(["Expenses", "Leave", "Parental leave"]);

    const leave = [...docs.values()].find((d) => d.title === "Leave")!;
    expect(leave.bodyMd).toContain("All leave policies live here.");
  });

  it("brings back the tree", async () => {
    const archive = await zipBytes(exportFiles(WORKSPACE, IMAGES));
    const { deps, docs } = fakeWorkspace();
    await runImport(markdownZipSource(archive), deps, {
      workspaceId: "ws2",
      docHref: (id) => `/w/new/docs/${id}`,
    });

    const byTitle = new Map([...docs.entries()].map(([id, d]) => [d.title, { id, ...d }]));
    expect(byTitle.get("Parental leave")!.parent).toBe(byTitle.get("Leave")!.id);
    expect(byTitle.get("Leave")!.parent).toBeNull();
  });

  it("brings back the spaces", async () => {
    const archive = await zipBytes(exportFiles(WORKSPACE, IMAGES));
    const { deps, docs } = fakeWorkspace();
    await runImport(markdownZipSource(archive), deps, {
      workspaceId: "ws2",
      docHref: (id) => `/w/new/docs/${id}`,
    });

    const byTitle = new Map([...docs.values()].map((d) => [d.title, d]));
    expect(byTitle.get("Leave")!.space).toBe("handbook");
    expect(byTitle.get("Expenses")!.space).toBe("finance");
  });

  it("brings back the images, re-uploaded rather than left pointing at the old instance", async () => {
    const archive = await zipBytes(exportFiles(WORKSPACE, IMAGES));
    const { deps, docs } = fakeWorkspace();
    await runImport(markdownZipSource(archive), deps, {
      workspaceId: "ws2",
      docHref: (id) => `/w/new/docs/${id}`,
    });

    const parental = [...docs.entries()].find(([, d]) => d.title === "Parental leave")!;
    expect(parental[1].bodyMd).toContain(`![The form](/api/images/ws1/${parental[0]}/form.png)`);
    // Nothing still points at the workspace it was exported from.
    expect(parental[1].bodyMd).not.toContain("_images/");
  });

  it("keeps the tags the export wrote", async () => {
    const archive = await zipBytes(exportFiles(WORKSPACE, IMAGES));
    const pages = [];
    for await (const page of markdownZipSource(archive).pages()) pages.push(page);

    const parental = pages.find((p) => p.title === "Parental leave")!;
    expect(parental.labels).toEqual(["hr"]);
  });
});
