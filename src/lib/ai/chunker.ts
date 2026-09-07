export type Chunk = {
  heading: string | null;
  content: string;
  index: number;
};

/**
 * Split Markdown into chunks at h2/h3 heading boundaries.
 * Each chunk gets its heading as context, plus a metadata prefix so the
 * embedding captures the doc-level context (title, space, type, status).
 * Sections longer than MAX_CHUNK_WORDS are split into multiple chunks that
 * share the same heading — without the cap, a long doc with no h2/h3 becomes
 * one giant chunk that blows the embedding model's token limit and fails the
 * whole embed call.
 */
export const MAX_CHUNK_WORDS = 400;

function splitByWords(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= MAX_CHUNK_WORDS) return [text];
  const parts: string[] = [];
  for (let i = 0; i < words.length; i += MAX_CHUNK_WORDS) {
    parts.push(words.slice(i, i + MAX_CHUNK_WORDS).join(" "));
  }
  return parts;
}

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

  const chunks: Chunk[] = [];
  for (const section of sections) {
    const metaPrefix = [
      `[Doc: ${docTitle}]`,
      `[Space: ${docSpace}]`,
      `[Type: ${docType}]`,
      `[Status: ${docStatus}]`,
      section.heading ? `[Section: ${section.heading}]` : null,
    ]
      .filter(Boolean)
      .join(" ");

    for (const part of splitByWords(section.lines.join("\n"))) {
      const content = [metaPrefix, "", section.heading ?? "", part]
        .filter((s) => s !== null)
        .join("\n")
        .trim();
      chunks.push({ heading: section.heading, content, index: chunks.length });
    }
  }
  return chunks;
}
