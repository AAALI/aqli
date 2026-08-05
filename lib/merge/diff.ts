/**
 * A line diff, for showing a reviewer what a proposal actually changes.
 *
 * Written here rather than pulled in as a dependency because the requirement
 * is narrow — two markdown bodies, rendered in a queue card — and a diff
 * library's cost is mostly in the parts we would not use.
 *
 * The algorithm is the standard LCS dynamic program. It is O(n·m) in lines,
 * which is fine for documents and not for novels, so `diffLines` trims a
 * common prefix and suffix first (most edits touch one paragraph) and falls
 * back to a whole-body replace above `MAX_LINES`.
 */

export type DiffOp = "context" | "add" | "remove";

export type DiffLine = {
  op: DiffOp;
  text: string;
  /** 1-based line number in the old body; null for an addition. */
  oldLine: number | null;
  /** 1-based line number in the new body; null for a removal. */
  newLine: number | null;
};

export type DiffStat = { added: number; removed: number };

/**
 * Above this the LCS table costs more than the diff is worth to a reviewer,
 * who is not going to read 4000 changed lines in a card either way.
 */
const MAX_LINES = 4000;

function splitLines(text: string): string[] {
  // A trailing newline is a line terminator, not an empty final line — without
  // this, every body that ends in "\n" shows a phantom blank change.
  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = splitLines(before ?? "");
  const b = splitLines(after ?? "");

  // Common prefix / suffix. Most edits are local, and shrinking the problem
  // here is what keeps the quadratic part small on a real document.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  const out: DiffLine[] = [];
  for (let i = 0; i < start; i++) {
    out.push({ op: "context", text: a[i], oldLine: i + 1, newLine: i + 1 });
  }

  if (midA.length * midB.length > MAX_LINES * MAX_LINES) {
    // Too big to align line by line. Say so honestly by showing it as a
    // wholesale replacement rather than pretending to a finer answer.
    midA.forEach((text, i) =>
      out.push({ op: "remove", text, oldLine: start + i + 1, newLine: null }),
    );
    midB.forEach((text, i) =>
      out.push({ op: "add", text, oldLine: null, newLine: start + i + 1 }),
    );
  } else {
    out.push(...lcsDiff(midA, midB, start));
  }

  for (let i = 0; i < a.length - endA; i++) {
    out.push({
      op: "context",
      text: a[endA + i],
      oldLine: endA + i + 1,
      newLine: endB + i + 1,
    });
  }

  return out;
}

function lcsDiff(a: string[], b: string[], offset: number): DiffLine[] {
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:].
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({
        op: "context",
        text: a[i],
        oldLine: offset + i + 1,
        newLine: offset + j + 1,
      });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ op: "remove", text: a[i], oldLine: offset + i + 1, newLine: null });
      i++;
    } else {
      out.push({ op: "add", text: b[j], oldLine: null, newLine: offset + j + 1 });
      j++;
    }
  }
  while (i < n) {
    out.push({ op: "remove", text: a[i], oldLine: offset + i + 1, newLine: null });
    i++;
  }
  while (j < m) {
    out.push({ op: "add", text: b[j], oldLine: null, newLine: offset + j + 1 });
    j++;
  }
  return out;
}

export function diffStat(lines: DiffLine[]): DiffStat {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.op === "add") added++;
    else if (line.op === "remove") removed++;
  }
  return { added, removed };
}

/**
 * Drop runs of unchanged lines longer than `context`, the way `diff -u` does.
 * A reviewer needs the change and enough around it to place it, not the whole
 * document.
 */
export function collapseContext(lines: DiffLine[], context = 3): DiffLine[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, i) => {
    if (line.op === "context") return;
    for (let j = Math.max(0, i - context); j <= Math.min(lines.length - 1, i + context); j++) {
      keep[j] = true;
    }
  });
  return lines.filter((_, i) => keep[i]);
}
