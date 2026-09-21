import { describe, expect, it } from "vitest";
import { firstParagraph, plain, whatChanged } from "@/lib/checks";

describe("whatChanged", () => {
  it("leads with what was added, in words", () => {
    const before = "## Refunds\n\nUnder AED 250 you can refund alone.\n\nCheques take a week.\n";
    const after = "## Refunds\n\nUnder **AED 500** you can refund alone.\n\nThe window is 30 days for annual plans.\n";
    expect(whatChanged(before, after)).toEqual([
      "Under AED 500 you can refund alone.",
      "The window is 30 days for annual plans.",
      "Removed: Under AED 250 you can refund alone.",
    ]);
  });
});

describe("firstParagraph", () => {
  it("skips headings and tables", () => {
    expect(firstParagraph("## Why\n\n| a | b |\n\nR09 means [insufficient funds](x).")).toBe(
      "R09 means insufficient funds.",
    );
  });
});

describe("plain", () => {
  it("drops list markers and emphasis", () => {
    expect(plain("- **Partial** refunds")).toBe("Partial refunds");
  });
});
