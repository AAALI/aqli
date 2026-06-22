export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** True when a doc hasn't been verified within `days` (or never has). */
export function isStale(lastReviewedAt: string | null, days = 90): boolean {
  if (!lastReviewedAt) return true;
  return Date.now() - new Date(lastReviewedAt).getTime() > days * 24 * 60 * 60 * 1000;
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #2F7D62, #0F6E56)", // green
  "linear-gradient(135deg, #4A6FB5, #2C4A82)", // blue
  "linear-gradient(135deg, #C7754A, #993C1D)", // orange
  "linear-gradient(135deg, #7C5CBF, #5B3FA0)", // purple
  "linear-gradient(135deg, #C45A7A, #A33058)", // rose
  "linear-gradient(135deg, #3F8FA8, #256880)", // teal
  "linear-gradient(135deg, #8A8A3A, #666628)", // olive
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export function formatRelative(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}
