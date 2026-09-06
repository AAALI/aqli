import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { markdownZipSource } from "../sources/markdown-zip";
import type { SourcePage } from "../types";

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

async function collect(archive: Uint8Array): Promise<SourcePage[]> {
  const pages: SourcePage[] = [];
  for await (const page of markdownZipSource(archive).pages()) pages.push(page);
  return pages;
}

describe("markdownZipSource", () => {
  it("takes the title from the first heading and removes it from the body", async () => {
    // Aqli renders the title itself; a document that repeats it reads as a mistake.
    const [page] = await collect(buildZip([{ path: "leave.md", body: "# Parental leave\n\nSix weeks.\n" }]));
    expect(page.title).toBe("Parental leave");
    expect(page.bodyMd).toBe("Six weeks.");
  });

  it("falls back to the filename when there is no heading", async () => {
    const [page] = await collect(buildZip([{ path: "parental-leave.md", body: "Six weeks.\n" }]));
    expect(page.title).toBe("Parental leave");
  });

  it("reads title and tags out of front matter", async () => {
    const [page] = await collect(
      buildZip([{ path: "x.md", body: '---\ntitle: "Expenses policy"\ntags: [finance, policy]\n---\n\nBody\n' }]),
    );
    expect(page.title).toBe("Expenses policy");
    expect(page.labels).toEqual(["finance", "policy"]);
    expect(page.bodyMd).toBe("Body");
  });

  it("uses the top folder as the space", async () => {
    const [page] = await collect(buildZip([{ path: "Handbook/leave.md", body: "Body" }]));
    expect(page.spaceKey).toBe("Handbook");
  });

  it("makes a file the parent of the folder that shares its name", async () => {
    // The shape every exported wiki has: leave.md beside a leave/ folder.
    const pages = await collect(
      buildZip([
        { path: "handbook/leave.md", body: "# Leave" },
        { path: "handbook/leave/parental.md", body: "# Parental leave" },
      ]),
    );
    const child = pages.find((p) => p.sourceId === "handbook/leave/parental.md");
    expect(child?.parentSourceId).toBe("handbook/leave.md");
  });

  it("leaves a page at the root when nothing owns its folder", async () => {
    const pages = await collect(buildZip([{ path: "handbook/leave/parental.md", body: "# Parental" }]));
    expect(pages[0].parentSourceId).toBeNull();
  });

  it("attaches only the files a page actually references", async () => {
    const pages = await collect(
      buildZip([
        { path: "a.md", body: "![Desk](images/desk.png)" },
        { path: "b.md", body: "No images here" },
        { path: "images/desk.png", body: "png" },
      ]),
    );
    expect(pages.find((p) => p.sourceId === "a.md")?.attachments.map((a) => a.filename)).toEqual([
      "desk.png",
    ]);
    expect(pages.find((p) => p.sourceId === "b.md")?.attachments).toEqual([]);
  });

  it("uses the file path as the page identity, so a re-run updates in place", async () => {
    const [page] = await collect(buildZip([{ path: "handbook/leave.md", body: "# Leave" }]));
    expect(page.sourceId).toBe("handbook/leave.md");
  });

  it("ignores non-markdown files as pages", async () => {
    const pages = await collect(
      buildZip([
        { path: "notes.md", body: "# Notes" },
        { path: "logo.png", body: "png" },
        { path: "data.csv", body: "a,b" },
      ]),
    );
    expect(pages.map((p) => p.sourceId)).toEqual(["notes.md"]);
  });
});
