"use client";

import { useState } from "react";
import Link from "next/link";
import Input from "@/components/ui/Input";
import DocStatusBadge from "@/components/docs/DocStatusBadge";
import type { DocStatus, DocType } from "@/types/doc";

type Result = {
  id: string;
  title: string;
  type: DocType;
  status: DocStatus;
  space_id: string | null;
  updated_at: string;
  body_md: string | null;
};

function excerpt(body: string | null, query: string): string {
  if (!body) return "";
  const term = query.split(/\s+/)[0]?.toLowerCase() ?? "";
  const idx = body.toLowerCase().indexOf(term);
  const start = idx > 40 ? idx - 40 : 0;
  return (start > 0 ? "…" : "") + body.slice(start, start + 160).trim() + "…";
}

export default function SearchClient({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string;
  workspaceSlug: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&workspace_id=${workspaceId}`,
      );
      const data = await res.json();
      setResults(data.results ?? []);
      setSearched(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="mb-4 text-xl font-semibold">Search</h1>
      <form onSubmit={run} className="mb-6 flex gap-2">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search docs by title and content…"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      {searched && results.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
          No results for &ldquo;{query}&rdquo;.
        </div>
      )}

      <div className="grid gap-3">
        {results.map((r) => (
          <Link
            key={r.id}
            href={`/w/${workspaceSlug}/docs/${r.id}`}
            className="block rounded-lg border border-neutral-200 p-4 hover:bg-neutral-50"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">{r.title}</h3>
              <DocStatusBadge status={r.status} />
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {excerpt(r.body_md, query)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
