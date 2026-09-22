import { diffLines } from "@/lib/merge/diff";
import { plain } from "@/lib/checks";

/**
 * How a version is described on the History screen (v3 §5.16, frame 16):
 * in prose — who changed it, whether anyone confirmed it after — above the
 * change itself, rather than as a list of timestamps and change types.
 */

/** "Threshold raised to AED 500": the proposal's own rationale if it had one,
 *  else the section the change touched, else what kind of version it was. */
export function versionLabel(opts: {
  n: number;
  rationale: string | null;
  before: string | null;
  after: string;
}): string {
  if (opts.rationale?.trim()) return clip(opts.rationale.trim().split("\n")[0], 60);
  if (opts.n === 1 || opts.before === null) return "First published";
  const section = changedSection(opts.before, opts.after);
  return section ? `Changed “${clip(section, 44)}”` : "Edited";
}

/** The heading above the first line that changed. */
export function changedSection(before: string, after: string): string | null {
  const lines = diffLines(before, after);
  let heading: string | null = null;
  for (const l of lines) {
    const m = l.text.match(/^#{1,3}\s+(.+)$/);
    if (m && l.op !== "remove") heading = m[1].trim();
    if (l.op !== "context") return m ? plain(m[1]) : heading;
  }
  return null;
}

const DAY = 86_400_000;

/** "Ali edited this, then Sara confirmed it the same day." */
export function versionProse(opts: {
  n: number;
  who: string;
  byAgent: boolean;
  at: string;
  confirmedBy: { name: string; at: string } | null;
}): string {
  const verb = opts.n === 1 ? (opts.byAgent ? "wrote and published" : "first published") : opts.byAgent ? "rewrote" : "edited";
  const first = `${opts.who} ${verb} this`;
  if (!opts.confirmedBy) return `${first}. Nobody has confirmed this version.`;
  const gap = Math.floor((Date.parse(opts.confirmedBy.at) - Date.parse(opts.at)) / DAY);
  const when = gap <= 0 ? "the same day" : gap === 1 ? "the next day" : `${gap} days later`;
  const confirmer = opts.confirmedBy.name === opts.who ? "confirmed it themselves" : `${opts.confirmedBy.name} confirmed it`;
  return `${first}, then ${confirmer} ${when}.`;
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}
