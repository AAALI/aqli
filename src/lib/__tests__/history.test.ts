import { describe, expect, it } from "vitest";
import { versionLabel, versionProse } from "@/lib/history";

describe("versionLabel", () => {
  it("prefers the change's own rationale", () => {
    expect(versionLabel({ n: 6, rationale: "Threshold raised to AED 500", before: "a", after: "b" })).toBe(
      "Threshold raised to AED 500",
    );
  });
  it("names the section a change touched", () => {
    const before = "## When you can do it alone\n\nUnder AED 250.\n";
    const after = "## When you can do it alone\n\nUnder AED 500.\n";
    expect(versionLabel({ n: 2, rationale: null, before, after })).toBe("Changed “When you can do it alone”");
  });
  it("calls the first version what it was", () => {
    expect(versionLabel({ n: 1, rationale: null, before: null, after: "x" })).toBe("First published");
  });
});

describe("versionProse", () => {
  it("reads as a sentence about people", () => {
    expect(
      versionProse({ n: 6, who: "Ali", byAgent: false, at: "2026-09-10T09:00:00Z", confirmedBy: { name: "Sara", at: "2026-09-10T15:00:00Z" } }),
    ).toBe("Ali edited this, then Sara confirmed it the same day.");
    expect(versionProse({ n: 3, who: "Claude Code", byAgent: true, at: "2026-09-10T09:00:00Z", confirmedBy: null })).toBe(
      "Claude Code rewrote this. Nobody has confirmed this version.",
    );
  });
});
