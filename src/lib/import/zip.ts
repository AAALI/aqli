/**
 * A minimal zip reader.
 *
 * Every export people arrive with is a zip — a Confluence space export, a
 * Notion export, a folder of markdown someone compressed. Node has no zip
 * reader in its standard library and neither does the Workers runtime, so this
 * is either a dependency or a hundred lines.
 *
 * It is a hundred lines, for two reasons. The bundle has a hard ceiling (C4)
 * and the admin upload route runs inside it; and the format's read path is
 * small — find the central directory, walk its entries, inflate the ones that
 * are deflated. `DecompressionStream("deflate-raw")` does the actual
 * decompression, and it exists in both runtimes.
 *
 * What it deliberately does not do: encryption, zip64 (>4 GB or >65,535
 * entries), and compression methods other than store and deflate. Each raises
 * rather than returning something subtly wrong.
 */
export type ZipEntry = {
  /** Path as recorded in the archive, with any leading "./" removed. */
  path: string;
  /** Uncompressed size in bytes, as declared by the central directory. */
  size: number;
  read: () => Promise<Uint8Array>;
};

const SIGNATURE_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const SIGNATURE_CENTRAL_FILE_HEADER = 0x02014b50;

const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

class Reader {
  constructor(private readonly bytes: Uint8Array) {}

  private view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);

  u16(offset: number): number {
    return this.view.getUint16(offset, true);
  }

  u32(offset: number): number {
    return this.view.getUint32(offset, true);
  }

  slice(start: number, end: number): Uint8Array {
    return this.bytes.subarray(start, end);
  }

  get length(): number {
    return this.bytes.length;
  }
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * The end-of-central-directory record is at the end of the file, after a
 * comment of unknown length — so it is found by scanning backwards for its
 * signature rather than computed.
 */
function findEndOfCentralDirectory(reader: Reader): number {
  const earliest = Math.max(0, reader.length - 0xffff - 22);
  for (let at = reader.length - 22; at >= earliest; at--) {
    if (reader.u32(at) === SIGNATURE_END_OF_CENTRAL_DIRECTORY) return at;
  }
  throw new Error("not a zip file: no end-of-central-directory record");
}

export function readZip(archive: Uint8Array): ZipEntry[] {
  const reader = new Reader(archive);
  const end = findEndOfCentralDirectory(reader);

  const count = reader.u16(end + 10);
  let at = reader.u32(end + 16);

  if (count === 0xffff || at === 0xffffffff) {
    throw new Error("zip64 archives are not supported; extract it and import the folder");
  }

  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (reader.u32(at) !== SIGNATURE_CENTRAL_FILE_HEADER) {
      throw new Error(`corrupt zip: expected a central directory entry at byte ${at}`);
    }

    const flags = reader.u16(at + 8);
    const method = reader.u16(at + 10);
    const compressedSize = reader.u32(at + 20);
    const size = reader.u32(at + 24);
    const nameLength = reader.u16(at + 28);
    const extraLength = reader.u16(at + 30);
    const commentLength = reader.u16(at + 32);
    const localHeaderAt = reader.u32(at + 42);

    const rawName = reader.slice(at + 46, at + 46 + nameLength);
    // Bit 11 means the name is UTF-8. Older archives are CP437, but its ASCII
    // range is identical and non-ASCII names are rare enough that decoding as
    // UTF-8 either way beats carrying a code-page table.
    const path = new TextDecoder("utf-8").decode(rawName).replace(/^\.\//, "");

    if ((flags & 0x0001) !== 0) {
      throw new Error(`encrypted entries are not supported: ${path}`);
    }

    at += 46 + nameLength + extraLength + commentLength;

    // Directories are recorded as zero-length entries with a trailing slash.
    if (path.endsWith("/")) continue;

    entries.push({
      path,
      size,
      read: async () => {
        // The local header repeats the name and extra fields, at their own
        // lengths — the central directory's are not reliable here.
        const localNameLength = reader.u16(localHeaderAt + 26);
        const localExtraLength = reader.u16(localHeaderAt + 28);
        const start = localHeaderAt + 30 + localNameLength + localExtraLength;
        const body = reader.slice(start, start + compressedSize);

        if (method === METHOD_STORE) return body;
        if (method === METHOD_DEFLATE) return inflateRaw(body);
        throw new Error(`unsupported compression method ${method} for ${path}`);
      },
    });
  }

  return entries;
}
