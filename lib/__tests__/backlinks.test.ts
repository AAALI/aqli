import { describe, expect, it } from "vitest";
import { citingSection } from "@/lib/backlinks";

const ID = "abc-123";

describe("citingSection", () => {
  it("returns the heading the citation sits under", () => {
    const md = [
      "# Rollout plan",
      "",
      "## Background",
      "",
      "Some prose.",
      "",
      "## Deliverables & timeline",
      "",
      `See [the brief](/w/acme/docs/${ID}) for the dates.`,
    ].join("\n");
    expect(citingSection(md, ID)).toBe("Deliverables & timeline");
  });

  it("uses the nearest preceding heading, not the first or the last", () => {
    const md = [
      "## One",
      `[x](/docs/${ID})`,
      "## Two",
      "no citation here",
    ].join("\n");
    expect(citingSection(md, ID)).toBe("One");
  });

  it("returns null when the citation is above any heading", () => {
    expect(citingSection(`intro [x](/docs/${ID})\n\n## Later`, ID)).toBeNull();
  });

  it("returns null when the doc is not cited at all", () => {
    expect(citingSection("## Heading\n\nnothing here", ID)).toBeNull();
  });

  it("handles an empty or missing body", () => {
    expect(citingSection(null, ID)).toBeNull();
    expect(citingSection("", ID)).toBeNull();
  });

  it("strips optional closing hashes from an ATX heading", () => {
    expect(citingSection(`## Scope ##\n[x](/docs/${ID})`, ID)).toBe("Scope");
  });

  it("does not mistake a horizontal rule or table divider for a heading", () => {
    const md = ["## Real heading", "", "---", "", `[x](/docs/${ID})`].join("\n");
    expect(citingSection(md, ID)).toBe("Real heading");
  });

  it("does not match a '#' that is not at the start of a line", () => {
    const md = ["## Real heading", "", `see #4 and [x](/docs/${ID})`].join("\n");
    expect(citingSection(md, ID)).toBe("Real heading");
  });
});
