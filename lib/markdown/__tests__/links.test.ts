import { describe, expect, it } from "vitest";
import { markdownToTiptap } from "../md-to-tiptap";
import { tiptapToMarkdown } from "../tiptap-to-md";

describe("markdown link conversion", () => {
  it("round-trips inline links used by editor citations", () => {
    const json = markdownToTiptap(
      "Use [Host Identity Verification](https://example.com/docs/identity) as the source.",
    );

    expect(tiptapToMarkdown(json)).toBe(
      "Use [Host Identity Verification](https://example.com/docs/identity) as the source.\n",
    );
  });
});
