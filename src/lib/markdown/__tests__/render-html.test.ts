/**
 * The server-side HTML renderer must show what the editor shows: same
 * structure, same attributes, same hidden title heading — and nothing a
 * document author wrote may reach the page as markup.
 */
import { describe, expect, test } from "vitest";
import { renderDocHtml } from "../render-html";
import { markdownToTiptap, type TiptapNode } from "../index";

function headingsOf(html: string): string[] {
  return Array.from(html.matchAll(/<h([1-3])>(.*?)<\/h\1>/g)).map((m) => m[2]);
}

function tiptapHeadings(node: TiptapNode): string[] {
  const out: string[] = [];
  const text = (n: TiptapNode): string => n.text ?? (n.content ?? []).map(text).join("");
  for (const child of node.content ?? []) if (child.type === "heading") out.push(text(child));
  return out;
}

describe("renderDocHtml", () => {
  test("an empty body renders nothing at all", () => {
    expect(renderDocHtml(null)).toBe("");
    expect(renderDocHtml("")).toBe("");
    expect(renderDocHtml("   \n")).toBe("");
  });

  test("writes the editor's DOM: paragraphs inside list items and cells", () => {
    const html = renderDocHtml("- one\n- two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n");
    expect(html).toContain("<li><p>one</p>\n</li>");
    expect(html).toContain('<div class="tbl"><table>');
    expect(html).toContain("<th>\n<p>A</p>\n</th>");
    expect(html).toContain("<td>\n<p>1</p>\n</td>");
  });

  test("clamps headings to the allowlist's h3, as the parser does", () => {
    const html = renderDocHtml("# One\n## Two\n### Three\n#### Four\n##### Five\n");
    expect(html).toContain("<h1>One</h1>");
    expect(html).toContain("<h3>Four</h3>");
    expect(html).toContain("<h3>Five</h3>");
    expect(html).not.toMatch(/<h[45]/);
  });

  test("hides a leading heading that repeats the title, and only that", () => {
    const md = "# Runbook: failover\n\n## When\n\nNow.\n";
    expect(renderDocHtml(md, "runbook: FAILOVER ")).not.toContain("<h1>");
    expect(renderDocHtml(md, "Another title")).toContain("<h1>Runbook: failover</h1>");
    // A matching heading further down is content, not the title.
    expect(renderDocHtml("Intro.\n\n# Runbook: failover\n", "Runbook: failover")).toContain("<h1>");
  });

  test("agrees with the editor about which headings a document has", () => {
    const md = "# Title\n\n## Setup\n\nText with `code` and *em*.\n\n#### Deep\n\n### Notes\n";
    expect(headingsOf(renderDocHtml(md))).toEqual(tiptapHeadings(markdownToTiptap(md)));
  });

  test("task lists carry the attributes the stylesheet and the editor use", () => {
    const html = renderDocHtml("- [x] done\n- [ ] todo\n");
    expect(html).toContain('<ul data-type="taskList">');
    expect(html).toContain('<li data-type="taskItem" data-checked="true"><label><input type="checkbox" disabled checked>');
    expect(html).toContain('<li data-type="taskItem" data-checked="false"><label><input type="checkbox" disabled>');
    expect(html).toContain("<div><p>todo</p>");
    expect(html).not.toContain("[ ]");
  });

  test("a mixed list stays a bullet list", () => {
    const html = renderDocHtml("- [x] done\n- plain\n");
    expect(html).not.toContain("taskList");
    expect(html).toContain("<p>[x] done</p>");
  });

  test("callouts become a blockquote attribute and lose their marker line", () => {
    const html = renderDocHtml("> [!WARNING]\n> Mind the gap.\n");
    expect(html).toContain('<blockquote data-callout="WARNING">');
    expect(html).toContain("<p>Mind the gap.</p>");
    expect(html).not.toContain("[!WARNING]");
    expect(renderDocHtml("> Just a quote.\n")).toContain("<blockquote>\n<p>Just a quote.</p>");
  });

  test("mermaid fences become a frame holding the source; other fences stay code", () => {
    const html = renderDocHtml("```mermaid\nflowchart TD\n  A --> B\n```\n\n```ts\nconst x = 1 < 2;\n```\n");
    expect(html).toContain('<div class="mmd" data-mermaid>');
    expect(html).toContain('<code class="language-mermaid">flowchart TD\n  A --&gt; B\n</code>');
    expect(html).toContain('<pre><code class="language-ts">const x = 1 &lt; 2;\n</code></pre>');
  });

  test("links open like the editor's; images load lazily with their alt text", () => {
    const html = renderDocHtml("[Docs](https://example.com) ![A *chart*](/api/images/ws/doc/x.png)\n");
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">Docs</a>');
    expect(html).toContain('<img src="/api/images/ws/doc/x.png" alt="A chart" loading="lazy" decoding="async">');
  });

  test("nothing an author writes reaches the page as markup", () => {
    const html = renderDocHtml(
      '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n![x](javascript:alert(1))\n\n# <b>bold</b>\n',
    );
    // No element survives: everything renders as escaped text.
    expect(html).not.toMatch(/<(script|img|a)\b/);
    expect(html).not.toContain("onerror=alert(1)>");
    expect(html).not.toMatch(/(href|src)="javascript:/);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<h1>&lt;b&gt;bold&lt;/b&gt;</h1>");
  });

  test("inline marks render as the editor's elements", () => {
    const html = renderDocHtml("**bold** *em* ~~gone~~ `code`  \nnext line\n\n---\n");
    expect(html).toContain("<strong>bold</strong> <em>em</em> <s>gone</s> <code>code</code><br>\nnext line");
    expect(html).toContain("<hr>");
  });
});
