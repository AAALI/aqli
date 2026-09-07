import { describe, it, expect, vi } from "vitest";
import { runImport } from "../pipeline";
import type { ImportDeps, ImportSource, SourcePage } from "../types";

function page(over: Partial<SourcePage> & { sourceId: string; title: string }): SourcePage {
  return {
    bodyMd: "",
    parentSourceId: null,
    spaceKey: null,
    attachments: [],
    author: null,
    createdAt: null,
    updatedAt: null,
    labels: [],
    notes: [],
    ...over,
  };
}

function source(pages: SourcePage[], name = "test-source"): ImportSource {
  return {
    name,
    pages: async function* () {
      for (const p of pages) yield p;
    },
  };
}

function makeDeps(over: Partial<ImportDeps> = {}): ImportDeps {
  let next = 0;
  return {
    findBySource: vi.fn().mockResolvedValue(null),
    createDoc: vi.fn().mockImplementation(async () => ({ id: `doc-${++next}` })),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    placeDoc: vi.fn().mockResolvedValue(undefined),
    uploadImage: vi
      .fn()
      .mockImplementation(async ({ docId, filename }) => `/api/images/ws/${docId}/${filename}`),
    resolveSpace: vi.fn().mockResolvedValue("space-1"),
    resolveAuthor: vi.fn().mockResolvedValue(null),
    ...over,
  };
}

const options = {
  workspaceId: "ws1",
  docHref: (id: string) => `/w/acme/docs/${id}`,
};

describe("runImport", () => {
  it("creates a document per page and reports each one", async () => {
    const deps = makeDeps();
    const report = await runImport(
      source([page({ sourceId: "1", title: "Benefits", bodyMd: "Body" })]),
      deps,
      options,
    );

    expect(deps.createDoc).toHaveBeenCalledTimes(1);
    expect(report.pages).toHaveLength(1);
    expect(report.pages[0]).toMatchObject({ status: "created", docId: "doc-1", title: "Benefits" });
  });

  it("updates rather than duplicating when a page was imported before", async () => {
    // The acceptance criterion that makes a failed import safe to re-run.
    const deps = makeDeps({
      findBySource: vi.fn().mockResolvedValue({ id: "existing-doc" }),
    });
    const report = await runImport(
      source([page({ sourceId: "1", title: "Benefits", bodyMd: "Body" })]),
      deps,
      options,
    );

    expect(deps.createDoc).not.toHaveBeenCalled();
    expect(deps.updateDoc).toHaveBeenCalledWith("existing-doc", expect.objectContaining({ title: "Benefits" }));
    expect(report.pages[0].status).toBe("updated");
  });

  it("places pages under their parents once every page exists", async () => {
    // The child arrives before the parent, which is the case that breaks a
    // one-pass importer.
    const deps = makeDeps();
    await runImport(
      source([
        page({ sourceId: "child", title: "Parental leave", parentSourceId: "parent" }),
        page({ sourceId: "parent", title: "Leave" }),
      ]),
      deps,
      options,
    );

    expect(deps.placeDoc).toHaveBeenCalledWith("doc-1", "doc-2");
  });

  it("says so when a parent was not in the export, and imports the page anyway", async () => {
    const deps = makeDeps();
    const report = await runImport(
      source([page({ sourceId: "child", title: "Orphan", parentSourceId: "missing" })]),
      deps,
      options,
    );

    expect(deps.placeDoc).not.toHaveBeenCalled();
    expect(report.pages[0].docId).toBe("doc-1");
    expect(report.pages[0].notes.some((n) => n.name.includes("missing"))).toBe(true);
  });

  it("uploads images and repoints the body at the stored copy", async () => {
    // C1: canonical markdown must never hold a link that expires.
    const deps = makeDeps();
    await runImport(
      source([
        page({
          sourceId: "1",
          title: "Onboarding",
          bodyMd: "Before\n\n![Desk](desk.png)\n\nAfter",
          attachments: [
            { id: "att-1", filename: "desk.png", mimeType: "image/png", read: async () => new Uint8Array([1]) },
          ],
        }),
      ]),
      deps,
      options,
    );

    expect(deps.uploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ docId: "doc-1", filename: "desk.png", mimeType: "image/png" }),
    );
    expect(deps.updateDoc).toHaveBeenCalledWith(
      "doc-1",
      expect.objectContaining({ bodyMd: expect.stringContaining("![Desk](/api/images/ws/doc-1/desk.png)") }),
    );
  });

  it("names attachments the image bucket cannot take instead of dropping them", async () => {
    const deps = makeDeps();
    const report = await runImport(
      source([
        page({
          sourceId: "1",
          title: "Policy",
          bodyMd: "[The form](form.pdf)",
          attachments: [
            { id: "att-1", filename: "form.pdf", mimeType: "application/pdf", read: async () => new Uint8Array([1]) },
          ],
        }),
      ]),
      deps,
      options,
    );

    expect(deps.uploadImage).not.toHaveBeenCalled();
    expect(report.pages[0].unplacedAttachments).toEqual(["form.pdf"]);
  });

  it("resolves a cross-reference to the document the other page became", async () => {
    const deps = makeDeps();
    await runImport(
      source([
        page({ sourceId: "1", title: "Leave", bodyMd: "See [Parental leave](/docs/parental-leave)" }),
        page({ sourceId: "2", title: "Parental leave", bodyMd: "Body" }),
      ]),
      deps,
      options,
    );

    expect(deps.updateDoc).toHaveBeenCalledWith(
      "doc-1",
      expect.objectContaining({ bodyMd: "See [Parental leave](/w/acme/docs/doc-2)" }),
    );
  });

  it("resolves a relative link between files in the same export", async () => {
    const deps = makeDeps();
    await runImport(
      source([
        page({ sourceId: "handbook/leave.md", title: "Leave", bodyMd: "See [expenses](./expenses.md)" }),
        page({ sourceId: "handbook/expenses.md", title: "Expenses", bodyMd: "Body" }),
      ]),
      deps,
      options,
    );

    expect(deps.updateDoc).toHaveBeenCalledWith(
      "doc-1",
      expect.objectContaining({ bodyMd: "See [expenses](/w/acme/docs/doc-2)" }),
    );
  });

  it("keeps the words of a link to a page outside the export, and reports it", async () => {
    // A dead link looks imported and is not. The label survives as text.
    const deps = makeDeps();
    const report = await runImport(
      source([page({ sourceId: "1", title: "Leave", bodyMd: "See [Sabbaticals](/docs/sabbaticals)" })]),
      deps,
      options,
    );

    expect(deps.updateDoc).toHaveBeenCalledWith("doc-1", { bodyMd: "See Sabbaticals" });
    expect(report.pages[0].unresolvedLinks).toEqual(["/docs/sabbaticals"]);
  });

  it("leaves external links alone", async () => {
    const deps = makeDeps();
    await runImport(
      source([page({ sourceId: "1", title: "Leave", bodyMd: "See [the law](https://example.gov/leave)" })]),
      deps,
      options,
    );
    expect(deps.updateDoc).not.toHaveBeenCalled();
  });

  it("maps an author to a member, and reports the ones it cannot", async () => {
    // An unmapped author becomes nothing at all — never a mention node, which
    // is not a doc-body node in this codebase (C1).
    const deps = makeDeps({
      resolveAuthor: vi.fn().mockImplementation(async (author: string | null) =>
        author === "jsmith" ? "user-1" : null,
      ),
    });
    const report = await runImport(
      source([
        page({ sourceId: "1", title: "A", author: "jsmith" }),
        page({ sourceId: "2", title: "B", author: "someone.who.left" }),
      ]),
      deps,
      options,
    );

    expect(deps.createDoc).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "user-1" }));
    expect(report.pages[0].unmappedAuthor).toBeNull();
    expect(report.pages[1].unmappedAuthor).toBe("someone.who.left");
  });

  it("carries every conversion note into the report", async () => {
    const report = await runImport(
      source([
        page({
          sourceId: "1",
          title: "Roadmap",
          notes: [{ kind: "unsupported-macro", name: "roadmap" }],
        }),
      ]),
      makeDeps(),
      options,
    );
    expect(report.pages[0].notes).toEqual([{ kind: "unsupported-macro", name: "roadmap" }]);
  });

  it("writes nothing on a dry run but still reports what would happen", async () => {
    const deps = makeDeps();
    const report = await runImport(
      source([
        page({
          sourceId: "1",
          title: "Benefits",
          bodyMd: "![Desk](desk.png)",
          attachments: [
            { id: "a", filename: "desk.png", mimeType: "image/png", read: async () => new Uint8Array() },
          ],
        }),
      ]),
      deps,
      { ...options, dryRun: true },
    );

    expect(deps.createDoc).not.toHaveBeenCalled();
    expect(deps.updateDoc).not.toHaveBeenCalled();
    expect(deps.uploadImage).not.toHaveBeenCalled();
    expect(report.dryRun).toBe(true);
    expect(report.pages[0].images).toEqual(["desk.png"]);
  });

  it("keeps going when one page fails, and says which", async () => {
    // One bad page in 1,361 must not cost the other 1,360.
    let call = 0;
    const deps = makeDeps({
      createDoc: vi.fn().mockImplementation(async () => {
        call += 1;
        if (call === 1) throw new Error("title too long");
        return { id: `doc-${call}` };
      }),
    });
    const report = await runImport(
      source([page({ sourceId: "1", title: "Bad" }), page({ sourceId: "2", title: "Good" })]),
      deps,
      options,
    );

    expect(report.pages[0]).toMatchObject({ status: "failed", error: "title too long" });
    expect(report.pages[1]).toMatchObject({ status: "created" });
  });

  it("reports a placement that the database refused rather than failing the run", async () => {
    // The tree guard refuses a parent in another space; the page is still
    // imported, and the report says why it is not where it was.
    const deps = makeDeps({
      placeDoc: vi.fn().mockRejectedValue(new Error("a sub-page must live in the same space as its parent")),
    });
    const report = await runImport(
      source([
        page({ sourceId: "parent", title: "Leave" }),
        page({ sourceId: "child", title: "Parental leave", parentSourceId: "parent" }),
      ]),
      deps,
      options,
    );

    expect(report.pages[1].notes.some((n) => n.name.includes("same space"))).toBe(true);
    expect(report.pages[1].status).toBe("created");
  });
});
