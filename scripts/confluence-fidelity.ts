/**
 * The corpus fidelity gate (brief step 2.4).
 *
 * Runs every page of a Confluence export through the rough storage-format
 * converter and then through the markdown round-trip gate, and reports where
 * markdown loses data. The point is not to build the importer — it is to find
 * out, against real and messy content rather than clean test data, whether the
 * markdown-canonical decision holds.
 *
 * Usage:
 *   pnpm confluence:fidelity --csv path/to/bodycontent.csv [--out report.md]
 *                            [--limit N] [--worst N]
 *
 * `bodycontent.csv` comes out of the Confluence space export zip. The column
 * layout differs between Confluence versions, so the body and id columns are
 * detected from the header rather than assumed.
 */
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { confluenceStorageToMarkdown, type ConversionNote } from "@/lib/confluence/storage-to-md";
import { normalize } from "@/lib/markdown";

type PageResult = {
  id: string;
  bytes: number;
  fixedPoint: boolean;
  retention: number;
  notes: ConversionNote[];
  error?: string;
};

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Streaming RFC-4180 reader.
 *
 * Confluence bodies are XHTML containing commas, quotes and newlines, so the
 * quoting rules have to be honoured properly — a line-based split corrupts the
 * corpus before the converter ever sees it. 58 MB also rules out reading the
 * file into memory as one string.
 */
async function* readCsvRows(path: string): AsyncGenerator<string[]> {
  const stream = createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 });

  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let quoteJustClosed = false;

  for await (const chunk of stream) {
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

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Visible words in raw XHTML, with tags and entities removed. */
function sourceWords(storage: string): string[] {
  const text = storage
    .replace(/<ac:parameter\b[^>]*>[\s\S]*?<\/ac:parameter>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ");
  return tokenize(text);
}

/** Visible words in markdown, with syntax removed. */
function markdownWords(markdown: string): string[] {
  const text = markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*/g, " "))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`|\\-]/g, " ");
  return tokenize(text);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
}

/**
 * Fraction of the source's visible words still present after conversion.
 *
 * A multiset comparison, so repeated words have to survive in the same number.
 * This is what catches a dropped macro body — the round-trip check alone would
 * happily call an empty document a perfect fixed point.
 */
function retention(storage: string, markdown: string): number {
  const source = sourceWords(storage);
  if (source.length === 0) return 1;

  const available = new Map<string, number>();
  for (const word of markdownWords(markdown)) {
    available.set(word, (available.get(word) ?? 0) + 1);
  }

  let kept = 0;
  for (const word of source) {
    const count = available.get(word) ?? 0;
    if (count > 0) {
      available.set(word, count - 1);
      kept++;
    }
  }
  return kept / source.length;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function buildReport(results: PageResult[], source: string): string {
  const total = results.length;
  const failed = results.filter((r) => !r.fixedPoint);
  const errored = results.filter((r) => r.error);
  const scores = results.map((r) => r.retention).sort((a, b) => a - b);
  const mean = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  const at = (q: number) => scores[Math.min(scores.length - 1, Math.floor(scores.length * q))] ?? 0;

  const macroCounts = new Map<string, number>();
  const elementCounts = new Map<string, number>();
  let attachments = 0;
  for (const result of results) {
    for (const note of result.notes) {
      if (note.kind === "unsupported-macro") {
        macroCounts.set(note.name, (macroCounts.get(note.name) ?? 0) + 1);
      } else if (note.kind === "unsupported-element") {
        elementCounts.set(note.name, (elementCounts.get(note.name) ?? 0) + 1);
      } else if (note.kind === "attachment") {
        attachments++;
      }
    }
  }

  const rank = (counts: Map<string, number>) =>
    [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

  const worst = [...results]
    .sort((a, b) => a.retention - b.retention)
    .slice(0, Number(process.env.WORST ?? 20));

  const failureRate = total === 0 ? 0 : failed.length / total;

  const lines: string[] = [
    "# Confluence corpus fidelity report",
    "",
    `Source: \`${source}\``,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Round-trip gate",
    "",
    "Each page is converted from storage-format XHTML to markdown, then checked",
    "for a fixed point: `serialize(parse(x))` must be stable under repetition.",
    "",
    "| Metric | Value |",
    "|---|---|",
    `| Pages | ${total} |`,
    `| Fixed point after one pass | ${total - failed.length} (${percent(total === 0 ? 1 : 1 - failureRate)}) |`,
    `| Failed the gate | ${failed.length} (${percent(failureRate)}) |`,
    `| Conversion errors | ${errored.length} |`,
    "",
    "## Text retention",
    "",
    "Fraction of the source page's visible words still present in the markdown.",
    "This is the measure that catches a dropped macro body — the round-trip check",
    "alone would call an empty page a perfect fixed point.",
    "",
    "| Percentile | Retention |",
    "|---|---|",
    `| Mean | ${percent(mean)} |`,
    `| p50 | ${percent(at(0.5))} |`,
    `| p10 | ${percent(at(0.1))} |`,
    `| p05 | ${percent(at(0.05))} |`,
    `| p01 | ${percent(at(0.01))} |`,
    `| min | ${percent(scores[0] ?? 0)} |`,
    "",
    `Attachment references seen: ${attachments}`,
    "",
  ];

  if (macroCounts.size > 0) {
    lines.push("## Macros with no handler", "", "| Macro | Pages |", "|---|---|");
    for (const [name, count] of rank(macroCounts)) lines.push(`| \`${name}\` | ${count} |`);
    lines.push("");
  }

  if (elementCounts.size > 0) {
    lines.push("## Elements with no handler", "", "| Element | Pages |", "|---|---|");
    for (const [name, count] of rank(elementCounts)) lines.push(`| \`${name}\` | ${count} |`);
    lines.push("");
  }

  lines.push(
    "## Worst pages by retention",
    "",
    "| Page id | Bytes | Retention | Fixed point | Notes |",
    "|---|---|---|---|---|",
  );
  for (const result of worst) {
    const notes = result.error
      ? `error: ${result.error}`
      : [...new Set(result.notes.map((n) => `${n.kind}:${n.name}`))].slice(0, 4).join(", ") || "—";
    lines.push(
      `| ${result.id} | ${result.bytes} | ${percent(result.retention)} | ${
        result.fixedPoint ? "yes" : "**no**"
      } | ${notes} |`,
    );
  }
  lines.push("");

  if (failed.length > 0) {
    lines.push("## Pages that failed the round-trip gate", "", "| Page id | Retention |", "|---|---|");
    for (const result of failed.slice(0, 50)) {
      lines.push(`| ${result.id} | ${percent(result.retention)} |`);
    }
    lines.push("");
  }

  lines.push(
    "## Verdict",
    "",
    failureRate > 0.02
      ? `**Stop.** ${percent(failureRate)} of pages failed the round-trip gate, above the 2% ` +
        "threshold in the brief. This is a signal about the design, not a bug to route around."
      : `Round-trip failures are ${percent(failureRate)}, within the 2% threshold in the brief.`,
    "",
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args.set(key, value);
  }
  return args;
}

/** Pick the body and id columns from the header, since layouts differ. */
function locateColumns(header: string[]): { body: number; id: number } {
  const lower = header.map((h) => h.trim().toLowerCase());
  const body = lower.findIndex((h) => h === "body" || h === "bodycontent" || h === "content");
  const id = lower.findIndex((h) => h === "contentid" || h === "bodyid" || h === "id");
  return { body: body === -1 ? 1 : body, id: id === -1 ? 0 : id };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = args.get("csv");
  if (!csvPath) {
    console.error(
      "usage: pnpm confluence:fidelity --csv <bodycontent.csv> [--out <report.md>] [--limit N]",
    );
    process.exitCode = 2;
    return;
  }

  const outPath = resolve(args.get("out") ?? "reports/confluence-fidelity.md");
  const limit = args.has("limit") ? Number(args.get("limit")) : Infinity;

  const results: PageResult[] = [];
  let header: string[] | null = null;
  let columns = { body: 1, id: 0 };

  for await (const row of readCsvRows(resolve(csvPath))) {
    if (!header) {
      header = row;
      columns = locateColumns(row);
      continue;
    }
    if (results.length >= limit) break;

    const storage = row[columns.body] ?? "";
    const id = row[columns.id] ?? String(results.length + 1);
    if (storage.trim() === "") continue;

    try {
      const { markdown, notes } = confluenceStorageToMarkdown(storage);
      const once = normalize(markdown);
      const twice = normalize(once);
      results.push({
        id,
        bytes: storage.length,
        fixedPoint: once === twice,
        retention: retention(storage, once),
        notes,
      });
    } catch (error) {
      results.push({
        id,
        bytes: storage.length,
        fixedPoint: false,
        retention: 0,
        notes: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (results.length % 200 === 0) {
      process.stderr.write(`  ${results.length} pages…\n`);
    }
  }

  const report = buildReport(results, csvPath);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, report, "utf8");

  const failed = results.filter((r) => !r.fixedPoint).length;
  const rate = results.length === 0 ? 0 : failed / results.length;
  console.log(`pages: ${results.length}`);
  console.log(`round-trip failures: ${failed} (${percent(rate)})`);
  console.log(`report: ${outPath}`);

  // Above the brief's 2% threshold this is a finding about the design, so the
  // command fails rather than passing quietly.
  if (rate > 0.02) process.exitCode = 1;
}

void main();
