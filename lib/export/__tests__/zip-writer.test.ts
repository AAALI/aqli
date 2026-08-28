import { describe, it, expect } from "vitest";
import { zipBytes } from "../zip-writer";
import { readZip } from "@/lib/import/zip";

const encode = (text: string) => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("zipBytes", () => {
  it("writes an archive the reader can read back", async () => {
    // The importer's reader is the one that matters: an export nothing can
    // open is not an exit door.
    const archive = await zipBytes([
      { path: "handbook/leave.md", bytes: encode("# Leave\n") },
      { path: "handbook/images/desk.png", bytes: new Uint8Array([137, 80, 78, 71]) },
    ]);

    const entries = readZip(archive);
    expect(entries.map((e) => e.path)).toEqual(["handbook/leave.md", "handbook/images/desk.png"]);
    expect(decode(await entries[0].read())).toBe("# Leave\n");
    expect(await entries[1].read()).toEqual(new Uint8Array([137, 80, 78, 71]));
  });

  it("is byte-identical for the same content", async () => {
    // The property that lets a customer diff this month's export against last
    // month's and see only what actually changed.
    const files = [
      { path: "a.md", bytes: encode("one") },
      { path: "b.md", bytes: encode("two") },
    ];
    const first = await zipBytes(files);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await zipBytes(files);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });

  it("differs when the content differs", async () => {
    const first = await zipBytes([{ path: "a.md", bytes: encode("one") }]);
    const second = await zipBytes([{ path: "a.md", bytes: encode("ONE") }]);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);
  });

  it("handles an empty workspace without producing something unreadable", async () => {
    const entries = readZip(await zipBytes([]));
    expect(entries).toEqual([]);
  });

  it("keeps unicode paths intact", async () => {
    const archive = await zipBytes([{ path: "espacio/política.md", bytes: encode("hola") }]);
    expect(readZip(archive)[0].path).toBe("espacio/política.md");
  });

  it("takes entries from an async source, so a large export is not assembled first", async () => {
    async function* pages() {
      for (let i = 0; i < 3; i++) yield { path: `page-${i}.md`, bytes: encode(`body ${i}`) };
    }
    const entries = readZip(await zipBytes(pages()));
    expect(entries).toHaveLength(3);
    expect(decode(await entries[2].read())).toBe("body 2");
  });
});
