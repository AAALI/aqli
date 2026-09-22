/** Helpers for Home. Plain module functions so the non-deterministic `Date`
 *  reads stay out of the React render tree, and so the wording is testable. */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NUMBERS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** "Wednesday morning." — the day and the part of it, nothing else. */
export function dayGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  const part = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return `${WEEKDAYS[now.getDay()]} ${part}.`;
}

function spell(n: number, lower = false): string {
  const w = n < NUMBERS.length ? NUMBERS[n] : String(n);
  return lower ? w.toLowerCase() : w;
}

/**
 * "One draft in flight, two things waiting on you." Says only what is true
 * and non-zero; a quiet day says so rather than listing zeroes.
 */
export function homeSummary(drafts: number, waiting: number): string {
  const parts: string[] = [];
  if (drafts > 0) parts.push(`${spell(drafts)} draft${drafts === 1 ? "" : "s"} in flight`);
  if (waiting > 0) {
    const w = `${spell(waiting, parts.length > 0)} thing${waiting === 1 ? "" : "s"} waiting on you`;
    parts.push(w);
  }
  if (parts.length === 0) return "Nothing is waiting on you.";
  return `${parts.join(", ")}.`;
}

/** Midnight at the start of this week's Monday, local time. */
export function startOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - back);
  return d;
}

/** "yesterday", "Mon", "just now" — how a row's right-hand date reads. */
export function shortDay(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((today.getTime() - new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return WEEKDAYS[then.getDay()].slice(0, 3);
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Where a draft was left: the last section heading, and whether the last
 * paragraph ends mid-sentence. Read from the markdown, so it costs nothing.
 */
export function whereLeftOff(bodyMd: string | null): { section: string | null; midSentence: boolean } {
  const md = (bodyMd ?? "").trim();
  const headings = [...md.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1].trim());
  const blocks = md.split(/\n{2,}/).map((b) => b.trim()).filter((b) => b && !b.startsWith("#"));
  const last = blocks[blocks.length - 1] ?? "";
  return {
    section: headings[headings.length - 1] ?? null,
    midSentence: last.length > 0 && !/[.!?:)"”'’]$/.test(last),
  };
}
