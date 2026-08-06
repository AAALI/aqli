/**
 * The viewer and the editor both hide a leading `# Title` that repeats the
 * doc's own title. The editor is the one that writes, so what matters is that
 * hiding it is reversible: strip on open, restore on save, and the markdown
 * that lands is the markdown that was there — otherwise opening a PR-imported
 * doc and typing one character would silently delete its first heading.
 */
import { describe, expect, test } from "vitest";
import { markdownToTiptap, tiptapToMarkdown } from "../index";
import {
  hasTitleHeading,
  prependTitleHeading,
  stripTitleHeading,
} from "../title-heading";

const WITH_TITLE = `# Runbook: payment processor failover

## When to use this

The primary processor is returning 5xx.
`;

const WITHOUT_TITLE = `## When to use this

The primary processor is returning 5xx.
`;

function open(md: string, title: string) {
  const doc = markdownToTiptap(md) as unknown as Record<string, unknown>;
  const carries = hasTitleHeading(doc, title);
  return { body: carries ? stripTitleHeading(doc) : doc, carries };
}

function save(body: Record<string, unknown>, title: string, carries: boolean) {
  return tiptapToMarkdown(carries ? prependTitleHeading(body, title) : body);
}

describe("title heading", () => {
  test("is recognised only when it matches the title", () => {
    const title = "Runbook: payment processor failover";
    expect(open(WITH_TITLE, title).carries).toBe(true);
    expect(open(WITHOUT_TITLE, title).carries).toBe(false);
    expect(open(WITH_TITLE, "Something else").carries).toBe(false);
    // A level-2 heading is body content, not a repeated title.
    expect(open(`## ${title}\n\ntext\n`, title).carries).toBe(false);
  });

  test("matches case-insensitively and ignores surrounding space", () => {
    expect(open("# Expense Policy\n\ntext\n", "  expense policy ").carries).toBe(true);
  });

  test("open then save is lossless", () => {
    const title = "Runbook: payment processor failover";
    const { body, carries } = open(WITH_TITLE, title);
    expect(save(body, title, carries)).toBe(WITH_TITLE);
  });

  test("a doc without the heading does not gain one", () => {
    const title = "Runbook: payment processor failover";
    const { body, carries } = open(WITHOUT_TITLE, title);
    expect(save(body, title, carries)).toBe(WITHOUT_TITLE);
  });

  test("renaming the doc rewrites the heading with it", () => {
    const title = "Runbook: payment processor failover";
    const { body, carries } = open(WITH_TITLE, title);
    expect(save(body, "Processor failover runbook", carries)).toBe(
      WITH_TITLE.replace(title, "Processor failover runbook"),
    );
  });

  test("the hidden heading is absent from what the editor holds", () => {
    const title = "Runbook: payment processor failover";
    const { body } = open(WITH_TITLE, title);
    expect(tiptapToMarkdown(body)).toBe(WITHOUT_TITLE);
  });
});
