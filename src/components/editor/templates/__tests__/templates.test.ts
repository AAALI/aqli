import { describe, expect, it } from "vitest";
import {
  DOC_TEMPLATE_SECTIONS,
  expectedSections,
  normalizeHeading,
  templateFor,
} from "@/components/editor/templates";
import { DOC_TYPES, type DocType } from "@/types/doc";

type Node = { type: string; attrs?: { level?: number }; content?: Node[] };

function textOf(node: Node): string {
  if (node.type === "text") return (node as unknown as { text: string }).text ?? "";
  return (node.content ?? []).map(textOf).join("");
}

const templated = (Object.keys(DOC_TEMPLATE_SECTIONS) as DocType[]).filter(
  (t) => DOC_TEMPLATE_SECTIONS[t]!.length > 0,
);

describe("templateFor", () => {
  it("covers every doc type except the deliberately blank `general`", () => {
    for (const type of DOC_TYPES) {
      if (type === "general") {
        expect(templateFor(type)).toBeNull();
      } else {
        expect(templateFor(type)).not.toBeNull();
      }
    }
  });

  it.each(templated)(
    "seeds %s with headings and empty paragraphs only — never prompt text",
    (type) => {
      const doc = templateFor(type)!;
      const nodes = doc.content as Node[];

      // The whole point of the redesign's template change: an unfilled doc must
      // not render its own scaffolding to readers as if it were prose.
      for (const node of nodes) {
        if (node.type === "paragraph") {
          expect(textOf(node)).toBe("");
        }
      }
      // And nothing else sneaks content in either — no seeded lists of
      // "Step 1 / Step 2" masquerading as body copy.
      expect(new Set(nodes.map((n) => n.type))).toEqual(
        new Set(["heading", "paragraph"]),
      );
    },
  );

  it.each(templated)("seeds %s with exactly its expected sections", (type) => {
    const doc = templateFor(type)!;
    const headings = (doc.content as Node[])
      .filter((n) => n.type === "heading")
      .map(textOf);
    expect(headings).toEqual(expectedSections(type).map((s) => s.heading));
  });

  it("seeds no title heading — the doc already has a title", () => {
    for (const type of templated) {
      const levels = (templateFor(type)!.content as Node[])
        .filter((n) => n.type === "heading")
        .map((n) => n.attrs?.level);
      expect(levels.every((l) => l === 2)).toBe(true);
    }
  });

  it("gives every expected section a hint, and keeps hints out of the body", () => {
    for (const type of templated) {
      const body = JSON.stringify(templateFor(type));
      for (const section of expectedSections(type)) {
        expect(section.hint.length).toBeGreaterThan(0);
        expect(body).not.toContain(section.hint);
      }
    }
  });
});

describe("normalizeHeading", () => {
  it("matches headings that differ only by case, punctuation or spacing", () => {
    expect(normalizeHeading("Open Questions")).toBe(normalizeHeading("open questions"));
    expect(normalizeHeading("Non-goals")).toBe(normalizeHeading("Non Goals"));
    expect(normalizeHeading("  Steps  ")).toBe(normalizeHeading("Steps"));
    expect(normalizeHeading("Deliverables & timeline")).toBe("deliverables timeline");
  });

  it("keeps genuinely different headings apart", () => {
    expect(normalizeHeading("Goals")).not.toBe(normalizeHeading("Non-goals"));
  });
});
