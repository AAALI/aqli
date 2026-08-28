/**
 * Reading the CSV files inside a Confluence space export.
 *
 * Extracted from `scripts/confluence-fidelity.ts` when the importer needed the
 * same reader: the gate that says a conversion is safe and the import that
 * relies on it must not disagree about how the corpus is read.
 */
import { createReadStream } from "node:fs";

/**
 * Streaming RFC-4180 reader.
 *
 * Confluence bodies are XHTML containing commas, quotes and newlines, so the
 * quoting rules have to be honoured properly — a line-based split corrupts the
 * corpus before the converter ever sees it. 58 MB also rules out reading the
 * file into memory as one string.
 */
export async function* readCsvRows(path: string): AsyncGenerator<string[]> {
  yield* parseCsv(createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 }));
}

/**
 * The same reader over any source of chunks.
 *
 * A zip entry arrives as one string and a 58 MB file arrives as a stream; both
 * have to be parsed by the same rules, so the parser takes chunks and the
 * callers decide where they come from.
 */
export async function* parseCsv(chunks: AsyncIterable<string>): AsyncGenerator<string[]> {
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let quoteJustClosed = false;

  for await (const chunk of chunks) {
    for (const char of chunk as string) {
      if (inQuotes) {
        if (char === '"') {
          inQuotes = false;
          quoteJustClosed = true;
        } else {
          field += char;
        }
        continue;
      }

      if (quoteJustClosed) {
        quoteJustClosed = false;
        // A doubled quote inside a quoted field is one literal quote.
        if (char === '"') {
          field += '"';
          inQuotes = true;
          continue;
        }
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        field = "";
        if (row.length > 1 || row[0] !== "") yield row;
        row = [];
      } else if (char !== "\r") {
        field += char;
      }
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    yield row;
  }
}
