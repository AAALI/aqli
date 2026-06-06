"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DOC_TYPES } from "@/types/doc";
import type { DocType } from "@/types/doc";
import Button from "@/components/ui/Button";

export default function NewDocClient({
  workspaceId,
  workspaceSlug,
  spaceId,
  spaceName,
}: {
  workspaceId: string;
  workspaceSlug: string;
  spaceId: string;
  spaceName: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocType>("general");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          space_id: spaceId,
          title: title.trim() || "Untitled",
          type,
        }),
      });
      if (res.ok) {
        const { doc } = await res.json();
        router.replace(`/w/${workspaceSlug}/docs/${doc.id}/edit`);
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-8 py-12">
      <h1 className="mb-1 text-xl font-semibold">New doc</h1>
      <p className="mb-6 text-sm text-neutral-500">in {spaceName}</p>

      <label className="mb-1 block text-sm font-medium text-neutral-700">
        Title
      </label>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder="Untitled"
        className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
      />

      <label className="mb-2 block text-sm font-medium text-neutral-700">
        Type
      </label>
      <div className="mb-6 flex flex-wrap gap-2">
        {DOC_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
              type === t
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {t.replace("_", " ")}
          </button>
        ))}
      </div>

      <Button onClick={create} disabled={busy}>
        {busy ? "Creating…" : "Create & edit"}
      </Button>
    </div>
  );
}
