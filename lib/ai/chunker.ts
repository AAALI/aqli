export type Chunk = {
  heading: string | null;
  content: string;
  index: number;
};

/**
 * Split Markdown into chunks at h2/h3 heading boundaries.
 * Each chunk gets its heading as context, plus a metadata prefix so the
 * embedding captures the doc-level context (title, space, type, status).
 * Max ~400 words per chunk — well within the embedding model's token limit.
 */
export function chunkMarkdown(
  markdown: string,
  docTitle: string,
  docType: string,
  docSpace: string,
  docStatus: string,
): Chunk[] {
  if (!markdown.trim()) return [];

  const lines = markdown.split("\n");
  const sections: { heading: string | null; lines: string[] }[] = [];
  let current: { heading: string | null; lines: string[] } = {
    heading: null,
    lines: [],
  };

  for (const line of lines) {
    if (/^#{2,3}\s/.test(line)) {
      if (current.lines.join("\n").trim()) {
        sections.push(current);
      }
      current = { heading: line.replace(/^#{2,3}\s/, "").trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }

  if (current.lines.join("\n").trim()) {
    sections.push(current);
  }

  return sections.map((section, index) => {
    const metaPrefix = [
      `[Doc: ${docTitle}]`,
      `[Space: ${docSpace}]`,
      `[Type: ${docType}]`,
      `[Status: ${docStatus}]`,
      section.heading ? `[Section: ${section.heading}]` : null,
    ]
      .filter(Boolean)
      .join(" ");

    const content = [metaPrefix, "", section.heading ?? "", section.lines.join("\n")]
      .filter((s) => s !== null)
      .join("\n")
      .trim();

    return { heading: section.heading, content, index };
  });
}
