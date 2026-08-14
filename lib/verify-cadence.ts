/**
 * How often a doc is supposed to be re-verified.
 *
 * Freshness used to be one hardcoded 90-day rule for every document, which
 * made the trust line either a nag on docs that genuinely change twice a year
 * or silent on the ones that go out of date in a month. The cadence rides in
 * `frontmatter.verify_cadence` (a jsonb column that already exists) rather
 * than a new column, so setting one needs no migration.
 */
export type VerifyCadence = "monthly" | "quarterly" | "biannual" | "annual" | "none";

/**
 * Unset docs keep the previous behaviour exactly: 90 days. Typed as the
 * literal, not `VerifyCadence`, so it can index `CADENCE_DAYS` — the default
 * is never "none".
 */
export const DEFAULT_CADENCE = "quarterly" as const satisfies VerifyCadence;

export const CADENCE_DAYS: Record<Exclude<VerifyCadence, "none">, number> = {
  monthly: 30,
  quarterly: 90,
  biannual: 182,
  annual: 365,
};

export const CADENCE_LABEL: Record<VerifyCadence, string> = {
  monthly: "monthly",
  quarterly: "quarterly",
  biannual: "twice a year",
  annual: "yearly",
  none: "no schedule",
};

export const CADENCES: VerifyCadence[] = [
  "monthly",
  "quarterly",
  "biannual",
  "annual",
  "none",
];

export function isCadence(value: unknown): value is VerifyCadence {
  return typeof value === "string" && (CADENCES as string[]).includes(value);
}

/** Read a cadence off a doc's frontmatter, falling back to the default. */
export function cadenceOf(value: unknown): VerifyCadence {
  return isCadence(value) ? value : DEFAULT_CADENCE;
}

/**
 * Whether a doc is overdue for verification under its own cadence.
 *
 * A doc that has never been verified is overdue unless it is explicitly on no
 * schedule — "we chose not to track this" is a decision, not a lapse.
 */
export function isStaleFor(
  lastReviewedAt: string | null,
  cadence: VerifyCadence = DEFAULT_CADENCE,
): boolean {
  if (cadence === "none") return false;
  if (!lastReviewedAt) return true;
  const days = CADENCE_DAYS[cadence];
  return Date.now() - new Date(lastReviewedAt).getTime() > days * 24 * 60 * 60 * 1000;
}
