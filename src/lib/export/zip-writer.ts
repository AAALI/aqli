/**
 * Writing a zip, deterministically, without buffering the archive.
 *
 * Two requirements shape this, and both come from what the export is *for*
 * (docs/adoption.md F-6). It is the answer to "can we leave?", so it has to be
 * checkable: two exports of unchanged content must be byte-identical, or a
 * customer cannot diff one against the next. And it has to survive a large
 * workspace on a Worker, so the archive is emitted as it is built rather than
 * assembled in memory.
 *
 * Entries are **stored, not deflated**. Compression would make the output
 * depend on the compressor's version and settings — the same content producing
 * a different archive next release is exactly the thing determinism is for —
 * and the bulk of a real export is images, which are already compressed.
 *
 * Timestamps are fixed rather than "now" for the same reason: an archive whose
 * bytes change every second cannot be compared with the last one.
 */
export type ZipFile = { path: string; bytes: Uint8Array };

/** Lazily built, because most requests never write a zip. */
let crcTable: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 1980-01-01 00:00:00 in DOS date/time — the epoch of the format itself, and
 * the smallest value it can express. Every entry gets it, so the archive says
 * nothing about when it was made and everything about what is in it.
 */
const DOS_TIME = 0;
const DOS_DATE = 33;

function localHeader(name: Uint8Array, bytes: Uint8Array, crc: number): Uint8Array {
  const header = new Uint8Array(30 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true); // version needed
  view.setUint16(6, 0x0800, true); // UTF-8 names
  view.setUint16(8, 0, true); // stored
  view.setUint16(10, DOS_TIME, true);
  view.setUint16(12, DOS_DATE, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, bytes.length, true);
  view.setUint32(22, bytes.length, true);
  view.setUint16(26, name.length, true);
  header.set(name, 30);
  return header;
}

function centralHeader(name: Uint8Array, bytes: Uint8Array, crc: number, offset: number): Uint8Array {
  const header = new Uint8Array(46 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true); // version made by
  view.setUint16(6, 20, true); // version needed
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, DOS_TIME, true);
  view.setUint16(14, DOS_DATE, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, bytes.length, true);
  view.setUint32(24, bytes.length, true);
  view.setUint16(28, name.length, true);
  view.setUint32(42, offset, true);
  header.set(name, 46);
  return header;
}

/**
 * The archive, emitted entry by entry.
 *
 * Peak memory is one file plus the central directory — a name and 46 bytes per
 * entry — not the workspace. A 2 GB export of a thousand documents and their
 * images never exists anywhere as a single value.
 */
export function zipStream(files: AsyncIterable<ZipFile> | Iterable<ZipFile>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator =
    Symbol.asyncIterator in files
      ? (files as AsyncIterable<ZipFile>)[Symbol.asyncIterator]()
      : (async function* () {
          yield* files as Iterable<ZipFile>;
        })();

  const central: Uint8Array[] = [];
  let offset = 0;
  let count = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next();

      if (!next.done) {
        const { path, bytes } = next.value;
        const name = encoder.encode(path);
        const crc = crc32(bytes);

        const header = localHeader(name, bytes, crc);
        controller.enqueue(header);
        controller.enqueue(bytes);

        central.push(centralHeader(name, bytes, crc, offset));
        offset += header.length + bytes.length;
        count += 1;
        return;
      }

      const directoryOffset = offset;
      let directorySize = 0;
      for (const record of central) {
        controller.enqueue(record);
        directorySize += record.length;
      }

      const end = new Uint8Array(22);
      const view = new DataView(end.buffer);
      view.setUint32(0, 0x06054b50, true);
      view.setUint16(8, count, true);
      view.setUint16(10, count, true);
      view.setUint32(12, directorySize, true);
      view.setUint32(16, directoryOffset, true);
      controller.enqueue(end);
      controller.close();
    },
  });
}

/** The whole archive as bytes — for a caller that has to hold it anyway, like a test. */
export async function zipBytes(files: AsyncIterable<ZipFile> | Iterable<ZipFile>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = zipStream(files).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
