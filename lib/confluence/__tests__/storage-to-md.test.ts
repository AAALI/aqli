/**
 * Tests for the rough Confluence converter used by the fidelity gate.
 *
 * The first two cases are the reason the gate exists: both were found by
 * running a corpus, not by reading the code, and both silently destroyed page
 * content rather than degrading it.
 */
import { describe, expect, it } from "vitest";
import { confluenceStorageToMarkdown } from "../storage-to-md";
import { normalize } from "@/lib/markdown";

const convert = (xml: string) => confluenceStorageToMarkdown(xml).markdown;

describe("storage-format quirks that an HTML parser gets wrong", () => {
  it("keeps content following a self-closing custom element", () => {
    // HTML has no self-closing syntax for unknown elements, so this used to be
    // read as an opening tag and every following block became its child — the
    // toc handler then dropped the entire page.
    const markdown = convert(
      '<p>before</p><ac:structured-macro ac:name="toc" /><h2>After</h2><p>kept</p>',
    );
    expect(markdown).toContain("before");
    expect(markdown).toContain("## After");
    expect(markdown).toContain("kept");
  });

  it("keeps a code macro body wrapped in CDATA", () => {
    // CDATA is a bogus comment in HTML, which silently emptied all 2,394 code
    // macros in the export.
    const markdown = convert(
      '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">sql</ac:parameter>' +
        "<ac:plain-text-body><![CDATA[select 1 from dual;]]></ac:plain-text-body></ac:structured-macro>",
    );
    expect(markdown).toContain("```sql");
    expect(markdown).toContain("select 1 from dual;");
  });
});

describe("macro handling (spec §8 census)", () => {
  it("unwraps inline comment markers, the most common element in the export", () => {
    expect(convert('<p>a <ac:inline-comment-marker ac:ref="x">b</ac:inline-comment-marker> c</p>')).toBe(
      "a b c\n",
    );
  });

  it("turns info/note/warning macros into GFM alerts", () => {
    const markdown = convert(
      '<ac:structured-macro ac:name="warning"><ac:rich-text-body><p>careful</p></ac:rich-text-body></ac:structured-macro>',
    );
    expect(markdown).toContain("> [!WARNING]");
    expect(markdown).toContain("> careful");
  });

  it("turns mermaid macros into native fences", () => {
    const markdown = convert(
      '<ac:structured-macro ac:name="mermaid-cloud"><ac:plain-text-body><![CDATA[flowchart TD\n  A --> B]]></ac:plain-text-body></ac:structured-macro>',
    );
    expect(markdown).toContain("```mermaid");
    expect(markdown).toContain("A --> B");
  });

  it("renders status macros as inline code", () => {
    expect(
      convert(
        '<p>State: <ac:structured-macro ac:name="status"><ac:parameter ac:name="title">DONE</ac:parameter></ac:structured-macro></p>',
      ),
    ).toBe("State: `DONE`\n");
  });

  it("turns ac:task-list into a GFM task list", () => {
    const markdown = convert(
      "<ac:task-list><ac:task><ac:task-status>complete</ac:task-status><ac:task-body>done thing</ac:task-body></ac:task>" +
        "<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>open thing</ac:task-body></ac:task></ac:task-list>",
    );
    expect(markdown).toContain("- [x] done thing");
    expect(markdown).toContain("- [ ] open thing");
  });

  it("flattens layout columns into sequential sections", () => {
    const markdown = convert(
      "<ac:layout><ac:layout-section><ac:layout-cell><p>left</p></ac:layout-cell>" +
        "<ac:layout-cell><p>right</p></ac:layout-cell></ac:layout-section></ac:layout>",
    );
    expect(markdown).toContain("left");
    expect(markdown).toContain("right");
  });

  it("walks ADF extensions rather than dropping them", () => {
    const markdown = convert(
      "<ac:adf-extension><ac:adf-node type='panel'><ac:adf-content><p>hidden panel</p></ac:adf-content></ac:adf-node></ac:adf-extension>",
    );
    expect(markdown).toContain("hidden panel");
  });

  it("records a macro it does not understand instead of losing it quietly", () => {
    const { notes } = confluenceStorageToMarkdown(
      '<ac:structured-macro ac:name="gliffy"><ac:rich-text-body><p>diagram caption</p></ac:rich-text-body></ac:structured-macro>',
    );
    expect(notes).toContainEqual({ kind: "unsupported-macro", name: "gliffy" });
  });
});

describe("converter output feeds the round-trip gate", () => {
  const samples = [
    '<h1>Title</h1><p>Body with <strong>bold</strong> and <code>ident_name</code>.</p>',
    "<table><tbody><tr><th><p>a</p></th><th><p>b</p></th></tr><tr><td><p>1</p></td><td><p>2|3</p></td></tr></tbody></table>",
    "<ul><li><p>one</p></li><li><p>two</p><ul><li><p>nested</p></li></ul></li></ul>",
    '<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[# not a heading\n- not a list]]></ac:plain-text-body></ac:structured-macro>',
    '<p>See <ac:link><ri:page ri:content-title="Order Flow" /><ac:plain-text-link-body>the doc</ac:plain-text-link-body></ac:link>.</p>',
  ];

  for (const [index, xml] of samples.entries()) {
    it(`sample ${index + 1} converts to a markdown fixed point`, () => {
      const once = normalize(convert(xml));
      expect(normalize(once)).toBe(once);
    });
  }
});
