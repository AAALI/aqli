import { describe, expect, it } from "vitest";
import { chunkMarkdown, MAX_CHUNK_WORDS } from "../chunker";

const chunk = (md: string) => chunkMarkdown(md, "Title", "general", "Engineering", "approved");

describe("chunkMarkdown", () => {
  it("splits at h2/h3 boundaries with sequential indexes", () => {
    const md = "Intro paragraph.\n\n## Section A\n\nBody A.\n\n### Section B\n\nBody B.";
    const chunks = chunk(md);
    expect(chunks.map((c) => c.heading)).toEqual([null, "Section A", "Section B"]);
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
    expect(chunks[1].content).toContain("[Section: Section A]");
  });

  it("caps oversized sections instead of emitting one giant chunk", () => {
    const md = Array.from({ length: MAX_CHUNK_WORDS * 3 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunk(md);
    expect(chunks.length).toBe(3);
    for (const c of chunks) {
      // Meta prefix adds a handful of words on top of the capped body.
      expect(c.content.split(/\s+/).length).toBeLessThanOrEqual(MAX_CHUNK_WORDS + 10);
    }
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it("returns nothing for empty markdown", () => {
    expect(chunk("")).toEqual([]);
    expect(chunk("   \n  ")).toEqual([]);
  });
});
