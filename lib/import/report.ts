/**
 * The import report.
 *
 * The acceptance criterion is "zero silent losses", and this is where that is
 * kept: every page gets a line, and every page that lost something says what.
 * It is written as markdown because the useful place for it is a document in
 * the workspace the import just filled — the cleanup pass is a checklist, and
 * the checklist belongs where the team already is.
 */
import type { ImportReport, PageOutcome } from "./types";

function needsAttention(page: PageOutcome): boolean {
  return (
    page.status === "failed" ||
    page.notes.length > 0 ||
    page.unplacedAttachments.length > 0 ||
    page.unresolvedLinks.length > 0 ||
    page.unmappedAuthor !== null
  );
}

function countBy(pages: PageOutcome[], pick: (page: PageOutcome) => string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const page of pages) {
    for (const key of pick(page)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function renderImportReport(report: ImportReport, docHref?: (id: string) => string): string {
  const { pages } = report;
  const created = pages.filter((p) => p.status === "created").length;
  const updated = pages.filter((p) => p.status === "updated").length;
  const failed = pages.filter((p) => p.status === "failed");
  const attention = pages.filter(needsAttention);

  const lines: string[] = [];

  lines.push(`# Import report — ${report.source}`);
  lines.push("");
  lines.push(
    report.dryRun
      ? "**Dry run.** Nothing was written. This is what the import would do."
      : `Imported ${report.startedAt} → ${report.finishedAt}.`,
  );
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Pages | ${pages.length} |`);
  lines.push(`| Created | ${created} |`);
  lines.push(`| Updated (re-run) | ${updated} |`);
  lines.push(`| Failed | ${failed.length} |`);
  lines.push(`| Needing a look | ${attention.length} |`);
  lines.push("");

  if (failed.length > 0) {
    lines.push("## Failed");
    lines.push("");
    lines.push("These pages were not imported. Re-running the import retries them.");
    lines.push("");
    for (const page of failed) {
      lines.push(`- **${page.title}** (\`${page.sourceId}\`) — ${page.error ?? "unknown error"}`);
    }
    lines.push("");
  }

  const macros = countBy(pages, (p) =>
    p.notes.filter((n) => n.kind === "unsupported-macro").map((n) => n.name),
  );
  const dropped = countBy(pages, (p) => p.notes.filter((n) => n.kind === "dropped").map((n) => n.name));
  const attachments = countBy(pages, (p) => p.unplacedAttachments.map((a) => a.split(".").pop() ?? a));
  const authors = countBy(pages, (p) => (p.unmappedAuthor ? [p.unmappedAuthor] : []));

  if (macros.length > 0 || dropped.length > 0) {
    lines.push("## What conversion could not represent");
    lines.push("");
    if (macros.length > 0) {
      lines.push("Macros with no handler — the surrounding text survived, the macro did not:");
      lines.push("");
      for (const [name, count] of macros) lines.push(`- \`${name}\` — ${count} page(s)`);
      lines.push("");
    }
    if (dropped.length > 0) {
      lines.push("Known content with no markdown form:");
      lines.push("");
      for (const [name, count] of dropped) lines.push(`- ${name} — ${count} page(s)`);
      lines.push("");
    }
  }

  if (attachments.length > 0) {
    lines.push("## Attachments to place by hand");
    lines.push("");
    lines.push(
      "Images were uploaded and re-linked. These are not images — the doc-images bucket " +
        "takes PNG, JPEG, GIF and WebP only — so they are listed against their page rather " +
        "than dropped.",
    );
    lines.push("");
    for (const [extension, count] of attachments) lines.push(`- \`.${extension}\` — ${count} file(s)`);
    lines.push("");
  }

  if (authors.length > 0) {
    lines.push("## Authors nobody matched");
    lines.push("");
    lines.push(
      "These pages kept their content and lost their author. Nothing was written into the " +
        "document body: a mention is not a doc-body node here, and an import must not invent one.",
    );
    lines.push("");
    for (const [author, count] of authors) lines.push(`- ${author} — ${count} page(s)`);
    lines.push("");
  }

  lines.push("## Every page");
  lines.push("");
  lines.push("| Page | Result | Images | To check |");
  lines.push("|---|---|---|---|");
  for (const page of pages) {
    const link = page.docId && docHref ? `[${page.title}](${docHref(page.docId)})` : page.title;
    const checks: string[] = [];
    if (page.error) checks.push(page.error);
    for (const note of page.notes) checks.push(`${note.kind}: ${note.name}`);
    for (const file of page.unplacedAttachments) checks.push(`attachment: ${file}`);
    for (const target of page.unresolvedLinks) checks.push(`link outside the export: ${target}`);
    if (page.unmappedAuthor) checks.push(`author: ${page.unmappedAuthor}`);

    lines.push(
      `| ${link} | ${page.status} | ${page.images.length} | ${
        checks.join("; ").replace(/\|/g, "\\|") || "—"
      } |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}
