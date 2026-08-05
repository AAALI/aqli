/**
 * Confluence storage-format XHTML -> markdown.
 *
 * This is the *rough* converter the round-trip gate borrows to get real, messy
 * content in front of the markdown pipeline (brief step 2.4). It is not the
 * production importer: attachments are not fetched, page links are not resolved
 * against imported ids, and user mentions are not looked up in
 * `user_mapping.csv`. Those are the second pass described in spec §8.
 *
 * Coverage follows the macro census in spec §8, which counted the markup
 * actually present in the export rather than guessing. Ten macro handlers and
 * seven element handlers cover essentially the whole corpus. Anything
 * unrecognised is recorded so the fidelity report can say what was dropped
 * instead of quietly losing it.
 */
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import type { Element, Node, Parent, Root, Text } from "hast";

export type ConversionNote =
  | { kind: "unsupported-macro"; name: string }
  | { kind: "unsupported-element"; name: string }
  | { kind: "attachment"; name: string }
  | { kind: "dropped"; name: string };

export type ConversionResult = {
  markdown: string;
  notes: ConversionNote[];
};

const parser = unified().use(rehypeParse, { fragment: true });

function isElement(node: Node): node is Element {
  return node.type === "element";
}

function isText(node: Node): node is Text {
  return node.type === "text";
}

function children(node: Node): Node[] {
  return (node as Parent).children ?? [];
}

/** Confluence namespaces its elements; rehype lowercases the tag name. */
function tag(node: Element): string {
  return node.tagName.toLowerCase();
}

function attr(node: Element, name: string): string | null {
  const value = node.properties?.[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(" ");
  if (typeof value === "number") return String(value);
  return null;
}

/**
 * `ac:parameter` children of a macro, keyed by their `ac:name`.
 *
 * rehype folds namespaced attributes into lowercase property names, and which
 * spelling survives depends on the attribute; both are checked.
 */
function macroParameters(node: Element): Map<string, string> {
  const out = new Map<string, string>();
  for (const child of children(node)) {
    if (!isElement(child) || tag(child) !== "ac:parameter") continue;
    const name = attr(child, "ac:name") ?? attr(child, "acname") ?? attr(child, "name");
    if (name) out.set(name, textOf(child).trim());
  }
  return out;
}

/** The `ac:plain-text-body` / `ac:rich-text-body` payload of a macro. */
function macroBody(node: Element, bodyTag: string): Element | null {
  for (const child of children(node)) {
    if (isElement(child) && tag(child) === bodyTag) return child;
  }
  return null;
}

function textOf(node: Node): string {
  if (isText(node)) return node.value;
  return children(node).map(textOf).join("");
}

/** Escape the characters that would otherwise be read as markdown syntax. */
function escapeInline(text: string): string {
  return text.replace(/([\\`*_[\]<>|~])/g, "\\$1");
}

type Context = {
  notes: ConversionNote[];
  /** Inside a table cell, block structure has to collapse to one line. */
  inTable: boolean;
};

const ALERT_BY_MACRO: Record<string, string> = {
  info: "NOTE",
  note: "NOTE",
  tip: "TIP",
  warning: "WARNING",
  panel: "NOTE",
};

/** Macros carrying no text worth keeping; regenerated or meaningless in markdown. */
const DROPPED_MACROS = new Set([
  "toc",
  "children",
  "roadmap",
  "recently-updated",
  "contributors",
  "pagetree",
  "livesearch",
]);

/**
 * Render inline content: marks, links, images, code spans.
 * Block-level children encountered here are flattened, which is what a table
 * cell needs and is harmless elsewhere.
 */
function renderInline(nodes: Node[], ctx: Context): string {
  return nodes.map((node) => renderInlineNode(node, ctx)).join("");
}

function renderInlineNode(node: Node, ctx: Context): string {
  if (isText(node)) return escapeInline(node.value);
  if (!isElement(node)) return "";

  const name = tag(node);
  const inner = () => renderInline(children(node), ctx);

  switch (name) {
    case "strong":
    case "b":
      return `**${inner()}**`;
    case "em":
    case "i":
      return `*${inner()}*`;
    case "del":
    case "s":
    case "strike":
      return `~~${inner()}~~`;
    case "code":
    case "tt": {
      // Code spans take their content literally, so the escaping above has to
      // be undone or every backtick-quoted identifier gains backslashes.
      const raw = textOf(node);
      const ticks = "`".repeat((raw.match(/`+/g) ?? [""]).reduce((a, b) => Math.max(a, b.length), 0) + 1);
      const pad = raw.startsWith("`") || raw.endsWith("`") ? " " : "";
      return `${ticks}${pad}${raw}${pad}${ticks}`;
    }
    case "br":
      return "\\\n";
    case "a": {
      const href = attr(node, "href");
      return href ? `[${inner()}](${href.replace(/[()]/g, "\\$&")})` : inner();
    }

    // The highest-frequency element in the export by a wide margin (8,158) and
    // pure noise: an inline comment anchor. Unwrap, keep the text.
    case "ac:inline-comment-marker":
      return inner();

    case "ac:link":
      return renderConfluenceLink(node, ctx);

    case "ac:image":
      return renderImage(node, ctx);

    case "ri:user": {
      const key =
        attr(node, "ri:userkey") ?? attr(node, "riuserkey") ?? attr(node, "ri:username") ?? "";
      // The production importer resolves these through user_mapping.csv.
      return `@${key || "unknown"}`;
    }

    case "ac:structured-macro":
      return renderMacroInline(node, ctx);

    case "ac:emoticon":
      return attr(node, "ac:name") ?? attr(node, "acname") ?? "";

    default:
      return inner();
  }
}

function renderConfluenceLink(node: Element, ctx: Context): string {
  let target = "";
  let label = "";

  for (const child of children(node)) {
    if (!isElement(child)) continue;
    const name = tag(child);
    if (name === "ri:page") {
      const title =
        attr(child, "ri:content-title") ?? attr(child, "ricontent-title") ?? attr(child, "ri:contenttitle");
      if (title) target = title;
    } else if (name === "ri:attachment") {
      const filename = attr(child, "ri:filename") ?? attr(child, "rifilename");
      if (filename) {
        target = filename;
        ctx.notes.push({ kind: "attachment", name: filename });
      }
    } else if (name === "ac:plain-text-link-body" || name === "ac:link-body") {
      label = renderInline(children(child), ctx);
    }
  }

  if (!label) label = escapeInline(target);
  if (!target) return label;

  // Pass 2 of the real importer rewrites these to /w/<ws>/docs/<slug> once
  // every page has an id. A stable placeholder is enough for the gate.
  const slug = target
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `[${label || escapeInline(target)}](/docs/${slug})`;
}

function renderImage(node: Element, ctx: Context): string {
  let source = "";
  for (const child of children(node)) {
    if (!isElement(child)) continue;
    const name = tag(child);
    if (name === "ri:attachment") {
      source = attr(child, "ri:filename") ?? attr(child, "rifilename") ?? "";
      if (source) ctx.notes.push({ kind: "attachment", name: source });
    } else if (name === "ri:url") {
      source = attr(child, "ri:value") ?? attr(child, "rivalue") ?? "";
    }
  }
  const alt = attr(node, "ac:alt") ?? attr(node, "acalt") ?? "";
  return source ? `![${escapeInline(alt)}](${source.replace(/[()]/g, "\\$&")})` : "";
}

/** Macros that read as inline content. */
function renderMacroInline(node: Element, ctx: Context): string {
  const name = (attr(node, "ac:name") ?? attr(node, "acname") ?? "").toLowerCase();
  const parameters = macroParameters(node);

  switch (name) {
    // 3,105 occurrences, the most common macro in the export.
    case "status": {
      const title = parameters.get("title") ?? "";
      return title ? `\`${title}\`` : "";
    }
    case "jira": {
      const key = parameters.get("key");
      return key ? `[${key}](https://jira/browse/${key})` : "";
    }
    default: {
      const block = renderMacroBlock(node, ctx);
      return block.replace(/\n+/g, " ").trim();
    }
  }
}

/** Macros that read as block content. */
function renderMacroBlock(node: Element, ctx: Context): string {
  const name = (attr(node, "ac:name") ?? attr(node, "acname") ?? "").toLowerCase();
  const parameters = macroParameters(node);

  if (DROPPED_MACROS.has(name)) {
    ctx.notes.push({ kind: "dropped", name });
    return "";
  }

  switch (name) {
    // 2,394 occurrences. `ac:parameter[language]` becomes the info string.
    case "code": {
      const body = macroBody(node, "ac:plain-text-body");
      const code = body ? textOf(body) : "";
      const language = (parameters.get("language") ?? "").replace(/[`~\s]/g, "");
      const fence = "`".repeat(
        Math.max(3, (code.match(/`+/g) ?? [""]).reduce((a, b) => Math.max(a, b.length), 0) + 1),
      );
      return `${fence}${language}\n${code.replace(/\n+$/, "")}\n${fence}\n`;
    }

    // 72 occurrences across three macro names. These become native markdown.
    case "mermaid":
    case "mermaid-cloud":
    case "mermaid-macro": {
      const body = macroBody(node, "ac:plain-text-body");
      const code = body ? textOf(body) : parameters.get("code") ?? "";
      return `\`\`\`mermaid\n${code.replace(/\n+$/, "")}\n\`\`\`\n`;
    }

    // 224 occurrences. GFM alerts, so they survive any markdown consumer.
    case "info":
    case "note":
    case "tip":
    case "warning":
    case "panel": {
      const body = macroBody(node, "ac:rich-text-body");
      const inner = body ? renderBlocks(children(body), ctx).trim() : "";
      const quoted = inner
        .split("\n")
        .map((line) => (line.trim() === "" ? ">" : `> ${line}`))
        .join("\n");
      return `> [!${ALERT_BY_MACRO[name]}]\n>\n${quoted}\n`;
    }

    case "expand": {
      const body = macroBody(node, "ac:rich-text-body");
      const inner = body ? renderBlocks(children(body), ctx).trim() : "";
      const title = parameters.get("title") ?? "Details";
      return `<details><summary>${title}</summary>\n\n${inner}\n\n</details>\n`;
    }

    // 221 occurrences. The real importer links to the migrated R2 object.
    case "view-file": {
      const filename = parameters.get("name") ?? "attachment";
      ctx.notes.push({ kind: "attachment", name: filename });
      return `[${escapeInline(filename)}](${filename})\n`;
    }

    // 83 occurrences with no clean text form; exported as images by the real
    // importer. Recorded rather than silently dropped.
    case "drawio":
    case "inc-drawio":
    case "drawio-sketch": {
      const diagram = parameters.get("diagramName") ?? parameters.get("diagramname") ?? "diagram";
      ctx.notes.push({ kind: "attachment", name: `${diagram}.png` });
      return `![${escapeInline(diagram)}](${diagram}.png)\n`;
    }

    case "status":
    case "jira":
      return `${renderMacroInline(node, ctx)}\n`;

    default: {
      ctx.notes.push({ kind: "unsupported-macro", name: name || "(unnamed)" });
      const body = macroBody(node, "ac:rich-text-body") ?? macroBody(node, "ac:plain-text-body");
      const inner = body ? renderBlocks(children(body), ctx).trim() : "";
      return inner ? `${inner}\n` : "";
    }
  }
}

function renderListItems(node: Element, ordered: boolean, ctx: Context, depth: number): string {
  const items: string[] = [];
  let index = 1;
  for (const child of children(node)) {
    if (!isElement(child) || tag(child) !== "li") continue;
    const marker = ordered ? `${index}. ` : "- ";
    const body = renderBlocks(children(child), ctx, depth + 1).trim();
    const indent = " ".repeat(marker.length);
    const lines = body.split("\n");
    const rendered = lines
      .map((line, i) => (i === 0 ? `${marker}${line}` : line.trim() === "" ? "" : `${indent}${line}`))
      .join("\n");
    items.push(rendered);
    index++;
  }
  return items.length ? `${items.join("\n")}\n` : "";
}

/** `ac:task-list` — 195 occurrences — becomes a GFM task list. */
function renderTaskList(node: Element, ctx: Context): string {
  const items: string[] = [];
  for (const child of children(node)) {
    if (!isElement(child) || tag(child) !== "ac:task") continue;
    let done = false;
    let body = "";
    for (const part of children(child)) {
      if (!isElement(part)) continue;
      const name = tag(part);
      if (name === "ac:task-status") done = textOf(part).trim() === "complete";
      else if (name === "ac:task-body") body = renderInline(children(part), ctx).trim();
    }
    items.push(`- [${done ? "x" : " "}] ${body}`);
  }
  return items.length ? `${items.join("\n")}\n` : "";
}

function renderTable(node: Element, ctx: Context): string {
  const rows: string[][] = [];

  const collectRows = (parent: Node) => {
    for (const child of children(parent)) {
      if (!isElement(child)) continue;
      const name = tag(child);
      if (name === "thead" || name === "tbody" || name === "tfoot") {
        collectRows(child);
      } else if (name === "tr") {
        const cells: string[] = [];
        for (const cell of children(child)) {
          if (!isElement(cell)) continue;
          if (tag(cell) !== "td" && tag(cell) !== "th") continue;
          const text = renderInline(children(cell), { ...ctx, inTable: true })
            .replace(/\n+/g, " ")
            .replace(/\|/g, "\\|")
            .trim();
          cells.push(text);
        }
        if (cells.length) rows.push(cells);
      }
    }
  };
  collectRows(node);

  if (rows.length === 0) return "";
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;

  return [line(rows[0]), `|${" --- |".repeat(width)}`, ...rows.slice(1).map(line)].join("\n") + "\n";
}

function renderBlocks(nodes: Node[], ctx: Context, depth = 0): string {
  const parts: string[] = [];

  for (const node of nodes) {
    if (isText(node)) {
      const text = node.value.trim();
      if (text) parts.push(`${escapeInline(node.value).trim()}\n`);
      continue;
    }
    if (!isElement(node)) continue;

    const name = tag(node);
    switch (name) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        // The allowlist stops at h3; deeper Confluence headings clamp to it.
        const level = Math.min(3, Number(name.slice(1)));
        const text = renderInline(children(node), ctx).trim();
        if (text) parts.push(`${"#".repeat(level)} ${text}\n`);
        break;
      }

      case "p": {
        const text = renderInline(children(node), ctx).trim();
        if (text) parts.push(`${text}\n`);
        break;
      }

      case "ul":
        parts.push(renderListItems(node, false, ctx, depth));
        break;
      case "ol":
        parts.push(renderListItems(node, true, ctx, depth));
        break;

      case "ac:task-list":
        parts.push(renderTaskList(node, ctx));
        break;

      case "blockquote": {
        const inner = renderBlocks(children(node), ctx, depth).trim();
        if (inner) {
          parts.push(
            `${inner
              .split("\n")
              .map((line) => (line.trim() === "" ? ">" : `> ${line}`))
              .join("\n")}\n`,
          );
        }
        break;
      }

      case "pre": {
        const code = textOf(node).replace(/\n+$/, "");
        parts.push(`\`\`\`\n${code}\n\`\`\`\n`);
        break;
      }

      case "hr":
        parts.push("***\n");
        break;

      case "table":
        parts.push(renderTable(node, ctx));
        break;

      case "ac:structured-macro":
        parts.push(renderMacroBlock(node, ctx));
        break;

      // 2,090 occurrences. Columns flatten to sequential sections — markdown
      // has no page layout, and reading order is what matters.
      case "ac:layout":
      case "ac:layout-section":
      case "ac:layout-cell":
      case "div":
      case "span":
      case "section":
      case "article":
      case "ac:rich-text-body":
        parts.push(renderBlocks(children(node), ctx, depth));
        break;

      // Newer ADF-in-storage-format. Its payload hides panels and expands, so
      // the children are walked rather than dropped.
      case "ac:adf-extension":
      case "ac:adf-node":
      case "ac:adf-content":
      case "ac:adf-fallback":
        parts.push(renderBlocks(children(node), ctx, depth));
        break;

      case "ac:inline-comment-marker": {
        const text = renderInline(children(node), ctx).trim();
        if (text) parts.push(`${text}\n`);
        break;
      }

      default: {
        const inline = renderInline([node], ctx).trim();
        if (inline) {
          parts.push(`${inline}\n`);
        } else {
          const inner = renderBlocks(children(node), ctx, depth);
          if (inner.trim()) parts.push(inner);
          else if (name.startsWith("ac:") || name.startsWith("ri:")) {
            ctx.notes.push({ kind: "unsupported-element", name });
          }
        }
      }
    }
  }

  return parts.filter((part) => part.trim() !== "").join("\n");
}

/** HTML elements that are genuinely void, so `<br/>` needs no expansion. */
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

/**
 * Make storage-format XML safe for an HTML parser.
 *
 * Confluence bodies are XHTML, and rehype-parse is HTML5. Two differences
 * corrupt the document rather than merely degrading it, and both were caught by
 * running the corpus:
 *
 *   - HTML has no self-closing syntax for unknown elements, so `<ac:image />`
 *     is read as an *opening* tag and the entire rest of the page becomes its
 *     child. A single `<ac:structured-macro ac:name="toc" />` near the top
 *     therefore swallowed the whole page, and the toc handler then dropped it.
 *   - `<![CDATA[ ... ]]>` is a bogus comment in HTML, so every `code` macro
 *     body — 2,394 of them — vanished silently.
 *
 * Both are repaired textually before parsing, which is cheaper and far more
 * predictable than swapping in a full XML parser for markup this constrained.
 */
function normaliseStorageXml(storage: string): string {
  // CDATA first, so markup inside it is inert for the pass that follows.
  const withoutCdata = storage.replace(
    /<!\[CDATA\[([\s\S]*?)\]\]>/g,
    (_match, content: string) =>
      content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  );

  return withoutCdata.replace(
    /<([a-zA-Z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\/>/g,
    (match, name: string, attributes: string) =>
      VOID_ELEMENTS.has(name.toLowerCase()) ? match : `<${name}${attributes}></${name}>`,
  );
}

/** Convert one Confluence storage-format body to markdown. */
export function confluenceStorageToMarkdown(storage: string): ConversionResult {
  const ctx: Context = { notes: [], inTable: false };
  const tree = parser.parse(normaliseStorageXml(storage)) as Root;
  const markdown = renderBlocks(children(tree), ctx).trim();
  return { markdown: markdown ? `${markdown}\n` : "", notes: ctx.notes };
}
