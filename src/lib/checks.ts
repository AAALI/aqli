import { diffLines } from "@/lib/merge/diff";

/** Markdown reduced to the words a person reads. */
export function plain(md: string): string {
  return md
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "What's different from v1" on a Checks card (frame 09): the few lines a
 * checker most needs to see, in words rather than a diff. Additions first,
 * because that is what they are being asked to stand behind; then what went.
 */
export function whatChanged(before: string, after: string, max = 3): string[] {
  const lines = diffLines(before, after);
  const added = lines.filter((l) => l.op === "add").map((l) => plain(l.text)).filter((t) => t.length > 3);
  const removed = lines.filter((l) => l.op === "remove").map((l) => plain(l.text)).filter((t) => t.length > 3);
  const out = added.map((t) => clip(t));
  for (const r of removed) {
    if (out.length >= max) break;
    out.push(`Removed: ${clip(r)}`);
  }
  return out.slice(0, max);
}

/** The first real paragraph, for a doc with nothing to compare against. */
export function firstParagraph(md: string | null, max = 220): string {
  const para = (md ?? "")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .find((b) => b && !b.startsWith("#") && !b.startsWith("|") && !b.startsWith("```"));
  return para ? clip(plain(para), max) : "";
}

function clip(s: string, max = 140): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
