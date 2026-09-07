import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { diffLines, diffStat, collapseContext, type DiffLine } from "../diff";

/** Reconstruct the old body from a diff: context + removals, in order. */
function oldOf(lines: DiffLine[]): string[] {
  return lines.filter((l) => l.op !== "add").map((l) => l.text);
}
/** Reconstruct the new body: context + additions, in order. */
function newOf(lines: DiffLine[]): string[] {
  return lines.filter((l) => l.op !== "remove").map((l) => l.text);
}

function split(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

describe("diffLines", () => {
  it("reports no changes for identical bodies", () => {
    const d = diffLines("# Title\n\nBody.\n", "# Title\n\nBody.\n");
    expect(d.every((l) => l.op === "context")).toBe(true);
    expect(diffStat(d)).toEqual({ added: 0, removed: 0 });
  });

  it("finds a single changed line in the middle of a document", () => {
    const before = "# Runbook\n\nStep one.\nStep two.\nStep three.\n";
    const after = "# Runbook\n\nStep one.\nStep two, revised.\nStep three.\n";
    const d = diffLines(before, after);

    expect(diffStat(d)).toEqual({ added: 1, removed: 1 });
    expect(d.find((l) => l.op === "remove")?.text).toBe("Step two.");
    expect(d.find((l) => l.op === "add")?.text).toBe("Step two, revised.");
  });

  it("treats a pure append as additions only", () => {
    const d = diffLines("a\nb\n", "a\nb\nc\nd\n");
    expect(diffStat(d)).toEqual({ added: 2, removed: 0 });
  });

  it("treats a pure deletion as removals only", () => {
    const d = diffLines("a\nb\nc\n", "a\nc\n");
    expect(diffStat(d)).toEqual({ added: 0, removed: 1 });
    expect(d.find((l) => l.op === "remove")?.text).toBe("b");
  });

  it("handles an empty side — a new document is all additions", () => {
    expect(diffStat(diffLines("", "a\nb\n"))).toEqual({ added: 2, removed: 0 });
    expect(diffStat(diffLines("a\nb\n", ""))).toEqual({ added: 0, removed: 2 });
  });

  // A trailing newline is a terminator. Without this the diff shows a phantom
  // change on every body that ends the way markdown bodies normally end.
  it("does not invent a change from a trailing newline", () => {
    const d = diffLines("a\nb", "a\nb\n");
    expect(diffStat(d)).toEqual({ added: 0, removed: 0 });
  });

  it("normalises CRLF rather than reporting every line as changed", () => {
    const d = diffLines("a\r\nb\r\n", "a\nb\n");
    expect(diffStat(d)).toEqual({ added: 0, removed: 0 });
  });

  it("numbers lines against the body each side came from", () => {
    const d = diffLines("a\nb\nc\n", "a\nx\nc\n");
    const removed = d.find((l) => l.op === "remove")!;
    const added = d.find((l) => l.op === "add")!;
    expect(removed).toMatchObject({ oldLine: 2, newLine: null });
    expect(added).toMatchObject({ oldLine: null, newLine: 2 });
    // Context after the change keeps counting on both sides.
    expect(d[d.length - 1]).toMatchObject({ text: "c", oldLine: 3, newLine: 3 });
  });

  // The property that matters: a diff a reviewer reads has to describe the
  // two bodies it claims to. If either side cannot be replayed from it, the
  // reviewer is approving something other than what they saw.
  it("replays back to both bodies, for any pair of documents", () => {
    const line = fc.stringMatching(/^[a-z #*\-.]{0,20}$/);
    fc.assert(
      fc.property(
        fc.array(line, { maxLength: 25 }),
        fc.array(line, { maxLength: 25 }),
        (a, b) => {
          const before = a.map((l) => `${l}\n`).join("");
          const after = b.map((l) => `${l}\n`).join("");
          const d = diffLines(before, after);
          expect(oldOf(d)).toEqual(split(before));
          expect(newOf(d)).toEqual(split(after));
        },
      ),
      { numRuns: 400 },
    );
  });

  it("never reports a change between a document and itself", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 12 }), { maxLength: 30 }), (a) => {
        const body = a.map((l) => `${l}\n`).join("");
        expect(diffStat(diffLines(body, body))).toEqual({ added: 0, removed: 0 });
      }),
      { numRuns: 200 },
    );
  });
});

describe("collapseContext", () => {
  it("keeps the change and a few lines either side, and drops the rest", () => {
    const before = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n");
    const after = before.replace("line 20", "line 20 changed");
    const full = diffLines(before, after);
    const collapsed = collapseContext(full, 3);

    expect(collapsed.length).toBeLessThan(full.length);
    expect(collapsed.some((l) => l.text === "line 20 changed")).toBe(true);
    expect(collapsed.some((l) => l.text === "line 17")).toBe(true);
    expect(collapsed.some((l) => l.text === "line 0")).toBe(false);
  });

  it("returns nothing when there is nothing to show", () => {
    expect(collapseContext(diffLines("a\nb\n", "a\nb\n"))).toEqual([]);
  });

  it("keeps every changed line", () => {
    const full = diffLines("a\nb\nc\nd\ne\n", "a\nB\nc\nD\ne\n");
    const collapsed = collapseContext(full, 1);
    const changed = full.filter((l) => l.op !== "context");
    for (const line of changed) expect(collapsed).toContainEqual(line);
  });
});
