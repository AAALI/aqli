/** Helpers for the Home ("Today in Aqli") surface. Plain module functions so
 *  the non-deterministic `Date` reads stay out of the React render tree. */

export function greeting(name: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${name}`;
}

export function todayLong(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** True when an ISO timestamp falls within the last `hours`. */
export function withinHours(iso: string, hours: number): boolean {
  return Date.now() - new Date(iso).getTime() < hours * 60 * 60 * 1000;
}

/** Bucket an ISO timestamp into the feed's day groups. */
export function dayBucket(iso: string): "Today" | "Yesterday" | "Earlier" {
  const then = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (then >= startOfToday) return "Today";
  if (then >= startOfYesterday) return "Yesterday";
  return "Earlier";
}
