"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/ui/Select";
import { DOC_TYPES, DOC_STATUSES } from "@/types/doc";
import type { Doc, DocType, DocStatus } from "@/types/doc";

export default function DocMeta({ doc }: { doc: Doc }) {
  const router = useRouter();
  const [type, setType] = useState<DocType>(doc.type);
  const [status, setStatus] = useState<DocStatus>(doc.status);
  const [linkedUrl, setLinkedUrl] = useState(
    doc.frontmatter?.linked_project_url ?? "",
  );
  const [tagsText, setTagsText] = useState(
    (doc.frontmatter?.tags ?? []).join(", "),
  );

  async function update(updates: Partial<Doc>) {
    await fetch(`/api/docs/${doc.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    router.refresh();
  }

  function commitFrontmatter(extra: Partial<typeof doc.frontmatter>) {
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    update({
      frontmatter: {
        ...doc.frontmatter,
        tags,
        linked_project_url: linkedUrl,
        ...extra,
      },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-8 py-2 text-sm text-neutral-600">
      <Select
        value={type}
        onChange={(e) => {
          const v = e.target.value as DocType;
          setType(v);
          update({ type: v });
        }}
        className="capitalize"
      >
        {DOC_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.replace("_", " ")}
          </option>
        ))}
      </Select>

      <Select
        value={status}
        onChange={(e) => {
          const v = e.target.value as DocStatus;
          setStatus(v);
          update({ status: v });
        }}
        className="capitalize"
      >
        {DOC_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      <input
        value={tagsText}
        onChange={(e) => setTagsText(e.target.value)}
        onBlur={() => commitFrontmatter({})}
        placeholder="tags, comma, separated"
        className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs"
      />

      <input
        value={linkedUrl}
        onChange={(e) => setLinkedUrl(e.target.value)}
        onBlur={() => commitFrontmatter({})}
        placeholder="Paste Linear / GitHub project URL"
        className="w-64 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs"
      />
    </div>
  );
}
