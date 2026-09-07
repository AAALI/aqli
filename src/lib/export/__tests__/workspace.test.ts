import { describe, it, expect } from "vitest";
import { docPaths, exportFiles, fileSlug, rewriteImageLinks, type ExportDoc } from "../workspace";

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

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

async function collect<T>(files: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const file of files) out.push(file);
  return out;
}

describe("fileSlug", () => {
  it("makes a name that survives any filesystem", () => {
    expect(fileSlug("Parental leave & pay!", "x")).toBe("parental-leave-pay");
  });

  it("falls back when a title has nothing usable in it", () => {
    expect(fileSlug("→ ✦ ←", "doc-1")).toBe("doc-1");
  });
});

describe("docPaths", () => {
  it("puts a document under its space", () => {
    const paths = docPaths([doc({ id: "1", title: "Leave" })]);
    expect(paths.get("1")).toBe("handbook/leave.md");
  });

  it("nests a sub-page inside a folder named for its parent", () => {
    // The convention the markdown importer reads back, so a tree exported
    // here comes home as a tree.
    const paths = docPaths([
      doc({ id: "1", title: "Leave" }),
      doc({ id: "2", title: "Parental leave", parentDocId: "1" }),
    ]);
    expect(paths.get("2")).toBe("handbook/leave/parental-leave.md");
  });

  it("handles three levels", () => {
    const paths = docPaths([
      doc({ id: "1", title: "Benefits" }),
      doc({ id: "2", title: "Leave", parentDocId: "1" }),
      doc({ id: "3", title: "Parental leave", parentDocId: "2" }),
    ]);
    expect(paths.get("3")).toBe("handbook/benefits/leave/parental-leave.md");
  });

  it("gives a document with no space somewhere to live", () => {
    const paths = docPaths([doc({ id: "1", title: "Loose", spaceSlug: null, spaceName: null })]);
    expect(paths.get("1")).toBe("no-space/loose.md");
  });
});

describe("rewriteImageLinks", () => {
  const images = new Set(["ws1/doc-1/desk.png"]);

  it("points an image at the copy inside the archive", () => {
    // Without this the export reads correctly only while signed in to the
    // instance it came from.
    const out = rewriteImageLinks(
      "![Desk](/api/images/ws1/doc-1/desk.png)",
      "handbook/leave.md",
      images,
    );
    expect(out).toBe("![Desk](../_images/ws1/doc-1/desk.png)");
  });

  it("counts the ../ from however deep the document sits", () => {
    const out = rewriteImageLinks(
      "![Desk](/api/images/ws1/doc-1/desk.png)",
      "handbook/benefits/leave/parental.md",
      images,
    );
    expect(out).toBe("![Desk](../../../_images/ws1/doc-1/desk.png)");
  });

  it("leaves an image it does not have alone rather than writing a broken path", () => {
    const out = rewriteImageLinks("![Gone](/api/images/ws1/doc-9/old.png)", "handbook/a.md", images);
    expect(out).toBe("![Gone](/api/images/ws1/doc-9/old.png)");
  });

  it("leaves external images alone", () => {
    const body = "![Logo](https://example.com/logo.png)";
    expect(rewriteImageLinks(body, "handbook/a.md", images)).toBe(body);
  });
});

describe("exportFiles", () => {
  it("writes front matter that says where the document came from", async () => {
    const [file] = await collect(
      exportFiles(
        [
          doc({
            id: "d1",
            title: "Parental leave",
            status: "approved",
            tags: ["hr", "policy"],
            currentRevisionId: "rev-7",
            updatedAt: "2026-08-01T00:00:00.000Z",
          }),
        ],
        [],
      ),
    );

    const body = text(file.bytes);
    expect(body).toContain('title: "Parental leave"');
    expect(body).toContain("status: approved");
    expect(body).toContain('space: "Handbook"');
    expect(body).toContain('tags: ["hr", "policy"]');
    expect(body).toContain("revision: rev-7");
    expect(body).toContain("aqli_id: d1");
  });

  it("names the parent by path, so the tree is readable without the database", async () => {
    const files = await collect(
      exportFiles(
        [doc({ id: "1", title: "Leave" }), doc({ id: "2", title: "Parental leave", parentDocId: "1" })],
        [],
      ),
    );
    const child = files.find((f) => f.path === "handbook/leave/parental-leave.md")!;
    expect(text(child.bytes)).toContain('parent: "handbook/leave.md"');
  });

  it("writes the title as a heading, which is what the importer reads back", async () => {
    const [file] = await collect(
      exportFiles([doc({ id: "1", title: "Leave", bodyMd: "All the policies." })], []),
    );
    expect(text(file.bytes)).toContain("# Leave\n\nAll the policies.\n");
  });

  it("includes the images, under a folder of their own", async () => {
    const files = await collect(
      exportFiles(
        [doc({ id: "1", title: "Leave", bodyMd: "![D](/api/images/ws1/1/desk.png)" })],
        [{ objectPath: "ws1/1/desk.png", read: async () => new Uint8Array([1, 2]) }],
      ),
    );
    expect(files.map((f) => f.path)).toContain("_images/ws1/1/desk.png");
  });

  it("emits files in a fixed order, which is half of determinism", async () => {
    const docs = [
      doc({ id: "3", title: "Zebra" }),
      doc({ id: "1", title: "Apple" }),
      doc({ id: "2", title: "Mango" }),
    ];
    const forward = (await collect(exportFiles(docs, []))).map((f) => f.path);
    const reversed = (await collect(exportFiles([...docs].reverse(), []))).map((f) => f.path);
    expect(forward).toEqual(reversed);
    expect(forward).toEqual([...forward].sort());
  });
});
