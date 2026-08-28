"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Summary = {
  pages: number;
  created: number;
  updated: number;
  failed: number;
  dryRun: boolean;
};

/**
 * Upload a zip, see what it would do, then do it.
 *
 * The dry run is not a nicety: an import writes across a whole workspace, and
 * the report is the only thing that says what a conversion lost before it is
 * lost in a place people are reading. So the first button is the safe one, and
 * applying is deliberately the second step.
 */
export default function ImportClient({
  workspaceId,
  workspaceSlug,
  base,
  spaces,
}: {
  workspaceId: string;
  workspaceSlug: string;
  base: string;
  spaces: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [spaceId, setSpaceId] = useState<string>(spaces[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportDocId, setReportDocId] = useState<string | null>(null);

  async function send(apply: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);

    const body = new FormData();
    body.set("file", file);
    body.set("workspace_id", workspaceId);
    if (spaceId) body.set("default_space_id", spaceId);
    body.set("apply", apply ? "true" : "false");

    try {
      const res = await fetch("/api/imports", { method: "POST", body });
      const data = (await res.json()) as {
        error?: string;
        summary?: Summary;
        report?: string;
        report_doc_id?: string | null;
      };
      if (!res.ok) {
        setError(data.error ?? "The import failed.");
        return;
      }
      setSummary(data.summary ?? null);
      setReport(data.report ?? null);
      setReportDocId(data.report_doc_id ?? null);
      if (apply) router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Import &amp; export</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.6, marginBottom: 20 }}>
        A zip of markdown files. Folders become the page tree — <code>leave.md</code> beside a{" "}
        <code>leave/</code> folder becomes the parent of what is inside it — and images referenced
        from a page are uploaded with it. Pages arrive approved, and re-importing the same archive
        updates those pages rather than duplicating them.
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: 12.5, lineHeight: 1.6, marginBottom: 24 }}>
        A Confluence space export is far larger than a browser upload can carry — run{" "}
        <code style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>pnpm import</code> for those.
      </p>

      <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16, background: "var(--bg-card)" }}>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
          Archive
        </label>
        <input
          type="file"
          accept=".zip,application/zip"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setSummary(null);
            setReport(null);
          }}
          style={{ fontSize: 13, marginBottom: 16, display: "block" }}
        />

        {spaces.length > 0 && (
          <>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
              Space for pages that do not name one
            </label>
            <select
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              style={{
                fontSize: 13,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                marginBottom: 16,
                display: "block",
                minWidth: 220,
              }}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!file || busy}
            onClick={() => send(false)}
          >
            {busy ? "Working…" : "Dry run"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!file || busy || !summary}
            onClick={() => send(true)}
            title={summary ? undefined : "Run the dry run first"}
          >
            Import
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "var(--danger-fg, #b91c1c)",
            background: "var(--danger-bg, #fee2e2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "9px 12px",
          }}
        >
          {error}
        </div>
      )}

      {summary && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            {summary.dryRun ? "What this would do" : "Imported"}
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginBottom: 12 }}>
            {summary.pages} page{summary.pages === 1 ? "" : "s"} — {summary.created} new,{" "}
            {summary.updated} updated, {summary.failed} failed.
          </p>

          {reportDocId && (
            <p style={{ fontSize: 13.5, marginBottom: 12 }}>
              <Link href={`${base}/docs/${reportDocId}`}>The full report is in your workspace →</Link>
            </p>
          )}

          {report && (
            <details>
              <summary style={{ fontSize: 13, cursor: "pointer", color: "var(--text-secondary)" }}>
                Report
              </summary>
              <pre
                style={{
                  marginTop: 10,
                  fontSize: 11.5,
                  fontFamily: "var(--font-mono)",
                  whiteSpace: "pre-wrap",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: 12,
                  maxHeight: 420,
                  overflow: "auto",
                }}
              >
                {report}
              </pre>
            </details>
          )}
        </div>
      )}
      <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "32px 0 24px" }} />

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Export</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.6, marginBottom: 14 }}>
        Every document as markdown, with its images, laid out as folders. It opens in any editor,
        and it imports back through the box above — which is what makes leaving a fact rather than a
        promise. Two exports of unchanged content are byte-identical, so you can diff one against
        the next.
      </p>
      <a
        className="btn btn-ghost"
        href={`/api/exports?workspace=${encodeURIComponent(workspaceSlug)}`}
        style={{ display: "inline-flex" }}
      >
        Download workspace
      </a>

    </div>
  );
}
