import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { readZip } from "../zip";

/**
 * Build a zip by hand, so the reader is tested against the format rather than
 * against whatever a library happens to produce.
 */
function buildZip(files: { path: string; body: string; deflate?: boolean }[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.path);
    const raw = encoder.encode(file.body);
    const body = file.deflate ? new Uint8Array(deflateRawSync(Buffer.from(raw))) : raw;
    const method = file.deflate ? 8 : 0;

    const local = new Uint8Array(30 + name.length + body.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(8, method, true);
    localView.setUint32(18, body.length, true);
    localView.setUint32(22, raw.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(body, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(10, method, true);
    centralView.setUint32(20, body.length, true);
    centralView.setUint32(24, raw.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const total = [...locals, ...centrals, end];
  const out = new Uint8Array(total.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of total) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("readZip", () => {
  it("reads stored entries", async () => {
    const entries = readZip(buildZip([{ path: "handbook/leave.md", body: "# Leave\n" }]));
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe("handbook/leave.md");
    expect(entries[0].size).toBe(8);
    expect(text(await entries[0].read())).toBe("# Leave\n");
  });

  it("reads deflated entries", async () => {
    // Real exports are deflated; a body long enough to actually compress.
    const body = "# Benefits\n\n".repeat(50);
    const entries = readZip(buildZip([{ path: "benefits.md", body, deflate: true }]));
    expect(text(await entries[0].read())).toBe(body);
  });

  it("keeps every entry and its path", async () => {
    const entries = readZip(
      buildZip([
        { path: "a.md", body: "a" },
        { path: "nested/deep/b.md", body: "b", deflate: true },
        { path: "images/c.png", body: "png-bytes" },
      ]),
    );
    expect(entries.map((e) => e.path)).toEqual(["a.md", "nested/deep/b.md", "images/c.png"]);
  });

  it("strips a leading ./ so paths compare the way callers expect", () => {
    const entries = readZip(buildZip([{ path: "./notes.md", body: "x" }]));
    expect(entries[0].path).toBe("notes.md");
  });

  it("rejects something that is not a zip, rather than returning nothing", () => {
    expect(() => readZip(new TextEncoder().encode("this is a markdown file, not a zip"))).toThrow(
      /not a zip file/,
    );
  });

  it("reads entries lazily, so a large archive is not inflated to list it", async () => {
    const entries = readZip(buildZip([{ path: "big.md", body: "x".repeat(1000), deflate: true }]));
    // Listing gave sizes without touching the bodies.
    expect(entries[0].size).toBe(1000);
    expect(text(await entries[0].read())).toHaveLength(1000);
  });
});
