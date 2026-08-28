import { describe, it, expect } from "vitest";
import { renderImportReport } from "../report";
import type { ImportReport, PageOutcome } from "../types";

function outcome(over: Partial<PageOutcome> & { sourceId: string; title: string }): PageOutcome {
  return {
    docId: "doc-1",
    status: "created",
    images: [],
    unplacedAttachments: [],
    unresolvedLinks: [],
    unmappedAuthor: null,
    notes: [],
    ...over,
  };
}

function report(pages: PageOutcome[], over: Partial<ImportReport> = {}): ImportReport {
  return {
    source: "confluence",
    startedAt: "2026-08-28T09:00:00.000Z",
    finishedAt: "2026-08-28T09:04:00.000Z",
    dryRun: false,
    pages,
    ...over,
  };
}

describe("renderImportReport", () => {
  it("counts what happened", () => {
    const out = renderImportReport(
      report([
        outcome({ sourceId: "1", title: "A" }),
        outcome({ sourceId: "2", title: "B", status: "updated" }),
        outcome({ sourceId: "3", title: "C", status: "failed", error: "title too long" }),
      ]),
    );
    expect(out).toContain("| Pages | 3 |");
    expect(out).toContain("| Created | 1 |");
    expect(out).toContain("| Updated (re-run) | 1 |");
    expect(out).toContain("| Failed | 1 |");
  });

  it("names every failed page and its reason", () => {
    const out = renderImportReport(
      report([outcome({ sourceId: "9", title: "Broken", status: "failed", error: "title too long" })]),
    );
    expect(out).toContain("## Failed");
    expect(out).toContain("**Broken**");
    expect(out).toContain("title too long");
  });

  it("groups unhandled macros by name, so a fix can be prioritised", () => {
    const out = renderImportReport(
      report([
        outcome({ sourceId: "1", title: "A", notes: [{ kind: "unsupported-macro", name: "jira" }] }),
        outcome({ sourceId: "2", title: "B", notes: [{ kind: "unsupported-macro", name: "jira" }] }),
        outcome({ sourceId: "3", title: "C", notes: [{ kind: "unsupported-macro", name: "roadmap" }] }),
      ]),
    );
    expect(out).toContain("`jira` — 2 page(s)");
    expect(out).toContain("`roadmap` — 1 page(s)");
  });

  it("lists attachments that could not be uploaded rather than hiding them", () => {
    const out = renderImportReport(
      report([outcome({ sourceId: "1", title: "Policy", unplacedAttachments: ["form.pdf", "rates.xlsx"] })]),
    );
    expect(out).toContain("## Attachments to place by hand");
    expect(out).toContain("`.pdf` — 1 file(s)");
    expect(out).toContain("`.xlsx` — 1 file(s)");
  });

  it("says which authors nobody matched, and why nothing was written into the body", () => {
    const out = renderImportReport(
      report([outcome({ sourceId: "1", title: "A", unmappedAuthor: "someone.who.left" })]),
    );
    expect(out).toContain("## Authors nobody matched");
    expect(out).toContain("someone.who.left");
    expect(out).toContain("mention is not a doc-body node");
  });

  it("gives every page a row, including the ones with nothing to report", () => {
    const out = renderImportReport(
      report([
        outcome({ sourceId: "1", title: "Clean page" }),
        outcome({ sourceId: "2", title: "Messy page", unresolvedLinks: ["/docs/gone"] }),
      ]),
    );
    expect(out).toContain("| Clean page | created | 0 | — |");
    expect(out).toContain("link outside the export: /docs/gone");
  });

  it("links each page when it knows how to", () => {
    const out = renderImportReport(
      report([outcome({ sourceId: "1", title: "A", docId: "doc-7" })]),
      (id) => `/w/acme/docs/${id}`,
    );
    expect(out).toContain("[A](/w/acme/docs/doc-7)");
  });

  it("escapes a pipe in a note rather than breaking the table it is in", () => {
    const out = renderImportReport(
      report([outcome({ sourceId: "1", title: "A", notes: [{ kind: "dropped", name: "a | b" }] })]),
    );
    expect(out).toContain("a \\| b");
  });

  it("says plainly when it was a dry run", () => {
    const out = renderImportReport(report([outcome({ sourceId: "1", title: "A" })], { dryRun: true }));
    expect(out).toContain("**Dry run.** Nothing was written.");
  });
});
