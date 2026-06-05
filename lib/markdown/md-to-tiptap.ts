/**
 * Minimal Markdown -> Tiptap JSON converter for Week 1.
 * Handles headings, bullet/ordered lists, blockquotes, code fences, hr, and
 * paragraphs with basic inline bold/italic/code. Good enough to seed the
 * editor; a richer parser can replace it later.
 */

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string }[];
};

export function markdownToTiptap(md: string | null | undefined): TiptapNode {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const content: TiptapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Code fence
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] || null;
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      content.push({
        type: "codeBlock",
        attrs: { language: lang },
        content: code.length ? [{ type: "text", text: code.join("\n") }] : [],
      });
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: inlineFromText(heading[2]),
      });
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      content.push({
        type: "blockquote",
        content: [
          { type: "paragraph", content: inlineFromText(quoteLines.join(" ")) },
        ],
      });
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(listItem(lines[i].replace(/^[-*]\s+/, "")));
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(listItem(lines[i].replace(/^\d+\.\s+/, "")));
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    // Paragraph (gather consecutive non-blank, non-special lines)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s|[-*]\s|\d+\.\s|>\s?|```|---+\s*$)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    content.push({ type: "paragraph", content: inlineFromText(para.join(" ")) });
  }

  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}

function listItem(text: string): TiptapNode {
  return {
    type: "listItem",
    content: [{ type: "paragraph", content: inlineFromText(text) }],
  };
}

function inlineFromText(text: string): TiptapNode[] {
  if (!text) return [];
  const tokens: TiptapNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ type: "text", text: text.slice(last, m.index) });
    }
    if (m[2] !== undefined) {
      tokens.push({ type: "text", text: m[2], marks: [{ type: "bold" }] });
    } else if (m[3] !== undefined) {
      tokens.push({ type: "text", text: m[3], marks: [{ type: "italic" }] });
    } else if (m[4] !== undefined) {
      tokens.push({ type: "text", text: m[4], marks: [{ type: "code" }] });
    }
    last = regex.lastIndex;
  }
  if (last < text.length) {
    tokens.push({ type: "text", text: text.slice(last) });
  }
  return tokens.length ? tokens : [{ type: "text", text }];
}
