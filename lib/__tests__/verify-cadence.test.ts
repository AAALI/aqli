import { describe, expect, it } from "vitest";
import {
  CADENCE_DAYS,
  DEFAULT_CADENCE,
  cadenceOf,
  isCadence,
  isStaleFor,
} from "@/lib/verify-cadence";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
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
