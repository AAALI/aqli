"use client";

import { IconFile } from "@/components/aqli/icons";
import { slugify } from "@/lib/utils";
import type { Doc } from "@/types/doc";

/** Builds a YAML frontmatter + markdown file and triggers a browser download. */
export default function DownloadMarkdownButton({ doc }: { doc: Doc }) {
  function download() {
    const fm = doc.frontmatter ?? { tags: [] };
    const frontmatter = [
      "---",
      `id: ${doc.id}`,
      `title: ${doc.title}`,
      `type: ${doc.type}`,
      `status: ${doc.status}`,
      `author_type: ${doc.author_type}`,
      `tags: [${(fm.tags ?? []).join(", ")}]`,
      fm.linked_project_url
        ? `linked_project_url: ${fm.linked_project_url}`
        : null,
      `updated_at: ${doc.updated_at}`,
      "---",
      "",
    ]
      .filter((l) => l !== null)
      .join("\n");

    const blob = new Blob([frontmatter + (doc.body_md ?? "")], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(doc.title) || "untitled"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="btn btn-ghost btn-icon"
      title="Download as Markdown"
      aria-label="Download as Markdown"
    >
      <IconFile size={15} />
    </button>
  );
}
