/**
 * Markdown -> HTML, for the reading surface.
 *
 * The doc page used to mount a read-only Tiptap editor to show a document: the
 * browser downloaded ProseMirror, every schema extension and markdown-it —
 * a quarter of a megabyte gzipped — parsed the markdown, built an editor state
 * and rendered it, all before the first word appeared. On a phone that was
 * seconds of blank paper. Markdown is canonical (step 6), so the server can
 * simply render it, and the body arrives as HTML in the first response.
 *
 * It renders what the editor renders. The same markdown-it tokeniser and the
 * same token rewrites (`tokens.ts`) feed it, and the HTML it writes mirrors the
 * editor's DOM — `<li><p>` inside lists, `<td><p>` inside cells, the task-list
 * and callout attributes the stylesheet already targets — so the `.dbody` rules
 * style both surfaces identically and the two cannot drift apart (v3 §2).
 *
 * Deliberately Tiptap-free: importing the schema here would put the editor
 * back in the server bundle, which is the one thing this file exists to avoid.
 *
 * Safety: the tokeniser runs with `html: false`, so raw HTML in a document is
 * escaped text; every attribute goes through markdown-it's own escaping; and
 * link and image URLs pass markdown-it's `validateLink`, which refuses
 * `javascript:` and friends. The output is safe to inject as-is.
 */
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import type { RenderRule } from "markdown-it/lib/renderer.mjs";
import { fenceLanguage, meta, normaliseTokens } from "./tokens";

/** Same options as the parser's tokeniser; this instance also carries the renderer rules. */
const md = MarkdownIt("default", { html: false, linkify: false });
const { escapeHtml } = md.utils;

/** The editor's heading allowlist stops at h3; deeper headings render as h3. */
const MAX_HEADING = 3;

const rules: Record<string, RenderRule> = {
  // The editor writes a paragraph inside every list item and table cell;
  // markdown-it hides them in tight lists. Always write them, so the list
  // spacing on the reading surface is the list spacing in the editor.
  paragraph_open: () => "<p>",
  paragraph_close: () => "</p>\n",

  heading_open: (tokens, i) => {
    const level = Math.min(MAX_HEADING, Number(tokens[i].tag.slice(1)) || 1);
    return `<h${level}>`;
  },
  heading_close: (tokens, i) => {
    const level = Math.min(MAX_HEADING, Number(tokens[i].tag.slice(1)) || 1);
    return `</h${level}>\n`;
  },

  blockquote_open: (tokens, i) => {
    const callout = meta(tokens[i]).callout;
    return callout ? `<blockquote data-callout="${callout}">\n` : "<blockquote>\n";
  },

  task_list_open: () => '<ul data-type="taskList">\n',
  task_list_close: () => "</ul>\n",
  // The exact DOM Tiptap's TaskItem renders, so `.dbody ul[data-type="taskList"] li`
  // lays both out the same. Disabled: a reader cannot tick a box here any more
  // than in the read-only editor.
  task_item_open: (tokens, i) => {
    const checked = meta(tokens[i]).checked === true;
    return (
      `<li data-type="taskItem" data-checked="${checked}">` +
      `<label><input type="checkbox" disabled${checked ? " checked" : ""}><span></span></label><div>`
    );
  },
  task_item_close: () => "</div></li>\n",

  // A wide table scrolls inside its own box rather than pushing the paper
  // column — and the whole page — sideways on a phone.
  table_open: () => '<div class="tbl"><table>\n',
  table_close: () => "</table></div>\n",

  fence: (tokens, i) => {
    const token = tokens[i];
    const language = fenceLanguage(token);
    const code = escapeHtml(token.content);
    if (language === "mermaid") {
      // The frame `MermaidIslands` fills in, once the diagram scrolls into
      // view. Until then — and without JavaScript — the source reads as code.
      return (
        '<div class="mmd" data-mermaid>' +
        '<div class="mmd-h">Diagram<span class="mmd-err"></span></div>' +
        `<pre class="mmd-src"><code class="language-mermaid">${code}</code></pre>` +
        '<div class="mmd-out"></div></div>\n'
      );
    }
    const cls = language ? ` class="language-${escapeHtml(language)}"` : "";
    return `<pre><code${cls}>${code}</code></pre>\n`;
  },

  link_open: (tokens, i, options, _env, self) => {
    // What Tiptap's Link mark writes.
    tokens[i].attrSet("target", "_blank");
    tokens[i].attrSet("rel", "noopener noreferrer nofollow");
    return self.renderToken(tokens, i, options);
  },

  image: (tokens, i, options, env, self) => {
    const token = tokens[i];
    // markdown-it keeps the alt text as child tokens; render them to plain text.
    token.attrSet("alt", self.renderInlineAsText(token.children ?? [], options, env));
    // Below-the-fold screenshots do not compete with the words for bandwidth.
    token.attrSet("loading", "lazy");
    token.attrSet("decoding", "async");
    return self.renderToken(tokens, i, options);
  },
};

for (const [name, rule] of Object.entries(rules)) md.renderer.rules[name] = rule;

/** Plain text of an inline token's children — what `nodeText` sees in the editor. */
function inlineText(token: Token): string {
  return (token.children ?? [])
    .filter((c) => c.type === "text" || c.type === "code_inline")
    .map((c) => c.content)
    .join("");
}

/**
 * Drop a leading `# Title` that repeats the document's own title, as the
 * editor and `title-heading.ts` do — the title is already on the page above
 * the body, set in the same serif.
 */
function withoutTitleHeading(tokens: Token[], title: string | null | undefined): Token[] {
  if (!title) return tokens;
  const [open, inline, close] = tokens;
  if (open?.type !== "heading_open" || open.tag !== "h1") return tokens;
  if (inline?.type !== "inline" || close?.type !== "heading_close") return tokens;
  if (inlineText(inline).trim().toLowerCase() !== title.trim().toLowerCase()) return tokens;
  return tokens.slice(3);
}

/**
 * Render a document body. Returns `""` for an empty document, so the caller
 * can tell "nothing to show" from "a paragraph with nothing in it".
 */
export function renderDocHtml(markdown: string | null | undefined, title?: string | null): string {
  if (!markdown || !markdown.trim()) return "";
  const env = {};
  const tokens = withoutTitleHeading(normaliseTokens(md.parse(markdown, env)), title);
  return md.renderer.render(tokens, md.options, env);
}
