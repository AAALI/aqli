/**
 * Minimal Tiptap JSON -> Markdown converter for Week 1.
 * Intentionally basic; covers StarterKit nodes. Replace with a proper
 * serializer (e.g. prosemirror-markdown) in a later milestone.
 */

type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: { type: string }[];
};

export function tiptapToMarkdown(
  doc: Record<string, unknown> | null | undefined,
): string {
  if (!doc) return "";
  const content = (doc as TiptapNode).content ?? [];
  return nodesToMarkdown(content).trim() + "\n";
}

function nodesToMarkdown(nodes: TiptapNode[]): string {
  return nodes.map(nodeToMarkdown).join("");
}

function nodeToMarkdown(node: TiptapNode): string {
  switch (node.type) {
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      return `${"#".repeat(level)} ${inlineToText(node.content)}\n\n`;
    }
    case "paragraph":
      return `${inlineToText(node.content)}\n\n`;
    case "bulletList":
      return (
        (node.content ?? [])
          .map((item) => `- ${listItemText(item)}`)
          .join("\n") + "\n\n"
      );
    case "orderedList":
      return (
        (node.content ?? [])
          .map((item, i) => `${i + 1}. ${listItemText(item)}`)
          .join("\n") + "\n\n"
      );
    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      return `\`\`\`${lang}\n${inlineToText(node.content)}\n\`\`\`\n\n`;
    }
    case "blockquote":
      return (
        nodesToMarkdown(node.content ?? [])
          .trim()
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n") + "\n\n"
      );
    case "horizontalRule":
      return `---\n\n`;
    case "hardBreak":
      return `\n`;
    default:
      if (node.content) return nodesToMarkdown(node.content);
      return "";
  }
}

function listItemText(item: TiptapNode): string {
  // A listItem contains block nodes (usually a paragraph). Flatten to text.
  return (item.content ?? [])
    .map((child) => inlineToText(child.content))
    .join(" ")
    .trim();
}

function inlineToText(nodes: TiptapNode[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      if (node.type !== "text") return inlineToText(node.content);
      let text = node.text ?? "";
      const marks = node.marks?.map((m) => m.type) ?? [];
      if (marks.includes("code")) text = `\`${text}\``;
      if (marks.includes("bold")) text = `**${text}**`;
      if (marks.includes("italic")) text = `*${text}*`;
      if (marks.includes("strike")) text = `~~${text}~~`;
      return text;
    })
    .join("");
}
