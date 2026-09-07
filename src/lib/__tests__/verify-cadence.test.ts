import { describe, expect, it } from "vitest";
import {
  CADENCE_DAYS,
  DEFAULT_CADENCE,
  cadenceOf,
  isCadence,
  isDocOverdue,
  isStaleFor,
  type VerifyCadence,
} from "@/lib/verify-cadence";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function doc(lastReviewedDaysAgo: number | null, cadence?: VerifyCadence) {
  return {
    last_reviewed_at: lastReviewedDaysAgo === null ? null : daysAgo(lastReviewedDaysAgo),
    frontmatter: cadence ? { verify_cadence: cadence } : null,
  };
}

describe("cadenceOf", () => {
  it("falls back to the default for anything it does not recognise", () => {
    expect(cadenceOf(undefined)).toBe(DEFAULT_CADENCE);
    expect(cadenceOf(null)).toBe(DEFAULT_CADENCE);
    expect(cadenceOf("weekly")).toBe(DEFAULT_CADENCE);
    expect(cadenceOf(30)).toBe(DEFAULT_CADENCE);
  });

  it("passes through a real cadence", () => {
    expect(cadenceOf("monthly")).toBe("monthly");
    expect(cadenceOf("none")).toBe("none");
  });

  it("is the guard's counterpart", () => {
    expect(isCadence("annual")).toBe(true);
    expect(isCadence("fortnightly")).toBe(false);
  });
});

describe("isStaleFor", () => {
  it("keeps the previous global behaviour for docs with no cadence set", () => {
    // The default is quarterly, which is the 90 days the old `isStale` used.
    expect(CADENCE_DAYS[DEFAULT_CADENCE]).toBe(90);
    expect(isStaleFor(daysAgo(89))).toBe(false);
    expect(isStaleFor(daysAgo(91))).toBe(true);
  });

  it("measures against the doc's own cadence", () => {
    const fortyDaysAgo = daysAgo(40);
    expect(isStaleFor(fortyDaysAgo, "monthly")).toBe(true);
    expect(isStaleFor(fortyDaysAgo, "quarterly")).toBe(false);
    expect(isStaleFor(fortyDaysAgo, "annual")).toBe(false);
  });

  it("treats a never-verified doc as overdue", () => {
    expect(isStaleFor(null, "monthly")).toBe(true);
    expect(isStaleFor(null, "annual")).toBe(true);
  });

  it("never nags a doc explicitly held to no schedule", () => {
    // "We decided not to track this" is a decision, not a lapse — this is what
    // stops the trust line being a permanent scold on reference material.
    expect(isStaleFor(null, "none")).toBe(false);
    expect(isStaleFor(daysAgo(5000), "none")).toBe(false);
  });
});

describe("isDocOverdue", () => {
  // The viewer's trust line and the "Needs updating" list both call this. If
  // they ever disagree, a reader sees a green "Verified" line on a doc the
  // workspace is simultaneously nagging them about.
  it("reads the cadence off the doc's own frontmatter", () => {
    expect(isDocOverdue(doc(40, "monthly"))).toBe(true);
    expect(isDocOverdue(doc(40, "quarterly"))).toBe(false);
    expect(isDocOverdue(doc(40, "annual"))).toBe(false);
  });

  it("falls back to the default when the doc has no frontmatter at all", () => {
    expect(isDocOverdue(doc(91))).toBe(true);
    expect(isDocOverdue(doc(89))).toBe(false);
  });

  it("excludes a doc held to no schedule however old it is", () => {
    expect(isDocOverdue(doc(5000, "none"))).toBe(false);
    expect(isDocOverdue(doc(null, "none"))).toBe(false);
  });

  it("agrees with isStaleFor for every cadence", () => {
    const cadences: VerifyCadence[] = ["monthly", "quarterly", "biannual", "annual", "none"];
    for (const cadence of cadences) {
      for (const age of [null, 0, 29, 31, 89, 91, 200, 400]) {
        const d = doc(age, cadence);
        expect(isDocOverdue(d)).toBe(isStaleFor(d.last_reviewed_at, cadence));
      }
    }
  });
});
