/**
 * The round-trip gate (spec §4.2).
 *
 * The whole markdown-canonical decision rests on this file. It asserts a fixed
 * point after one normalization pass — `serialize(parse(x))` is stable under
 * repetition — rather than byte-equality with arbitrary input, which is
 * unachievable (the first pass legitimately rewrites `*` bullets to `-` and
 * setext headings to ATX). Stability is the property that actually matters: it
 * guarantees an edit cycle never quietly rewrites a document, and therefore
 * that no content is lost on repeated saves.
 *
 * A green suite that never stressed the converters would be worse than a red
 * one, so the generator below is built to produce the shapes that break naive
 * serializers: nested lists inside blockquotes, code fences containing
 * markdown, tables with pipes in cells, links with parentheses, and mixed
 * inline marks.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { hostileMarkdown, wellFormedMarkdown } from "./arbitrary";
import {
  ALLOWED_MARKS,
  ALLOWED_NODES,
  aqliSchema,
  normalize,
  parse,
  serialize,
  tiptapToMarkdown,
} from "@/lib/markdown";

/** One normalization pass must be a no-op on already-normalized markdown. */
function expectFixedPoint(markdown: string): void {
  const once = normalize(markdown);
  const twice = normalize(once);
  expect(twice).toBe(once);
}

// ---------------------------------------------------------------------------
// Hand-written adversarial cases
// ---------------------------------------------------------------------------

const ADVERSARIAL: Record<string, string> = {
  "nested list inside blockquote": "> - outer\n>   - inner\n>     - deepest\n",
  "ordered list inside blockquote": "> 1. one\n>    1. nested\n",
  "blockquote inside list": "- item\n\n  > quoted\n",
  "code fence containing markdown": "```\n# Not a heading\n\n- not a list\n\n| not | a table |\n```\n",
  "code fence containing a fence": "````md\n```js\nconst x = 1;\n```\n````\n",
  "code fence with no language": "```\nplain\n```\n",
  "inline code containing backticks": "Use `` a`b `` here.\n",
  "inline code containing asterisks": "Use `a * b` here.\n",
  "table with pipes in cells": "| a | b |\n| --- | --- |\n| x \\| y | z |\n",
  "table with marks in cells": "| **bold** | `code` |\n| --- | --- |\n| *it* | [l](http://x) |\n",
  "table with empty cells": "| a | b |\n| --- | --- |\n|  | z |\n",
  "link with parentheses in url": "[t](http://x.com/a\\(b\\)c)\n",
  "link with title": '[t](http://x.com "the title")\n',
  "image with parentheses": "![alt](http://x.com/a\\(b\\).png)\n",
  "mixed inline marks": "***both*** ~~struck~~ `code` [link](http://x)\n",
  "bold inside italic inside link": "[*a **b***](http://x)\n",
  "strikethrough with code": "~~`gone`~~\n",
  "task list": "- [ ] open\n- [x] done\n",
  "nested task list": "- [ ] outer\n  - [x] inner\n",
  "list that only looks like a task list": "- \\[ \\] not a task\n- plain\n",
  "callout note": "> [!NOTE]\n> Body.\n",
  "callout with list": "> [!WARNING]\n> - one\n> - two\n",
  "every callout kind": "> [!IMPORTANT]\n> a\n\n> [!CAUTION]\n> b\n\n> [!TIP]\n> c\n",
  "hard break": "line one\\\nline two\n",
  "horizontal rule between paragraphs": "a\n\n---\n\nb\n",
  "heading levels": "# one\n\n## two\n\n### three\n",
  "text with markdown metacharacters": "a * b _ c ` d ~ e [ f ] g\n",
  "underscores inside a word": "snake_case_name stays intact\n",
  "numbers that look like a list": "1986. was a year\n",
  "empty document": "",
  "only whitespace": "   \n\n  \n",
  "consecutive blockquotes": "> a\n\n> b\n",
  "deeply nested lists": "- a\n  - b\n    - c\n      - d\n",
  "ordered list with custom start": "5. five\n6. six\n",

  // Every case below was found by the property test against an earlier version
  // of the converters. Each one was a real defect; they are pinned here so a
  // future change has to break a named test rather than a random seed.
  "empty link leaves no stranded whitespace": "[](http://x) `A`\n",
  "blockquote as the first block in a list item": "- > quoted\n",
  "nested list as the first block in a list item": "- - inner\n",
  "thematic break inside a list item": "- ****\n",
  "empty task item keeps its checkbox": "- [ ]\n",
  "callout followed by a thematic break": "> [!NOTE]\n> ***\n",
  "callout whose body would underline it": "> [!NOTE]\n>\n> =\n",
  "italic run ending in whitespace": "*a * b\n",
  "emphasis alternating bold and bold-italic": "**_a_b_c_d**\n",
  "runs of literal underscores": "\\_\\_A\\_\\_ *x*\n",
  "identifiers in code spans are not escaped": "`snake_case` and prose snake_case\n",
  "code span padded with spaces": "` x `\n",
  "code span of only spaces": "`   `\n",
  "code fence info string with backticks": "~~~~\n`(`\n~~~~\n",
  "heading ending in a hash": "# #\n",
  "paragraph that is only a plus": "+\n",
  "paragraph that is only an ordered marker": "0.\n",
  "text starting with an ordered marker": "1986) was a year\n",
  "adjacent sibling lists stay separate": "- a\n\n* b\n",
};

describe("adversarial round-trips", () => {
  for (const [name, markdown] of Object.entries(ADVERSARIAL)) {
    it(`${name} is a fixed point`, () => {
      expectFixedPoint(markdown);
    });
  }
});

// ---------------------------------------------------------------------------
// Schema/serializer coverage
// ---------------------------------------------------------------------------

describe("schema and serializer agree", () => {
  it("the schema contains exactly the allowlisted nodes", () => {
    const actual = Object.keys(aqliSchema.nodes)
      .filter((n) => n !== "doc" && n !== "text")
      .sort();
    expect(actual).toEqual([...ALLOWED_NODES].sort());
  });

  it("the schema contains exactly the allowlisted marks", () => {
    expect(Object.keys(aqliSchema.marks).sort()).toEqual([...ALLOWED_MARKS].sort());
  });

  it("has no underline mark, which markdown cannot represent", () => {
    expect(aqliSchema.marks.underline).toBeUndefined();
  });

  it("drops marks the allowlist no longer admits rather than throwing", () => {
    // A document saved before the schema was constrained.
    const legacy = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "kept", marks: [{ type: "bold" }] },
            { type: "text", text: " and underlined", marks: [{ type: "underline" }] },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(legacy)).toBe("**kept** and underlined\n");
  });
});

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

/**
 * Two guarantees, because they are not the same strength.
 *
 * For markdown a person or a converter would actually write, one normalization
 * pass reaches a fixed point exactly. That is the guarantee the editor and the
 * importer rely on: saving a document twice cannot change it.
 *
 * For deliberately malformed source, CommonMark's emphasis rules can leave
 * marks spanning inline boundaries in a shape no serializer can spell
 * unambiguously, so a rare document needs a second pass before it settles. It
 * always settles — it never oscillates and it never loses content — and that
 * weaker claim is asserted rather than papered over.
 */
describe("md -> pm -> md is stable", () => {
  it("well-formed markdown is a fixed point after one pass", () => {
    fc.assert(
      fc.property(wellFormedMarkdown, (markdown) => {
        const once = normalize(markdown);
        return normalize(once) === once;
      }),
      { numRuns: 20000 },
    );
  });

  it("our own output is a fixed point", () => {
    fc.assert(
      fc.property(wellFormedMarkdown, (markdown) => {
        const once = normalize(markdown);
        return serialize(parse(once)) === once;
      }),
      { numRuns: 10000 },
    );
  });

  it("malformed markdown always converges, within two passes", () => {
    fc.assert(
      fc.property(hostileMarkdown, (markdown) => {
        const once = normalize(markdown);
        const twice = normalize(once);
        return normalize(twice) === twice;
      }),
      { numRuns: 20000 },
    );
  });
});
