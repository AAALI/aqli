/**
 * Step 2.5 — backfill `body_md`, `body_text` and `headings` (brief step 2.5).
 *
 * Regenerates `body_md` from `body_json` with the new serializer, gated on the
 * round-trip test passing for that document. A document that fails the gate is
 * logged and skipped, never written — the whole point of the gate is that a
 * document we cannot represent losslessly must not have its markdown replaced
 * by a lossy version.
 *
 * Behaviour-neutral by construction:
 *
 *   * `body_json` remains canonical. Only the derived markdown changes.
 *   * `updated_at` is preserved. The `docs_maintain_derived` trigger sets it to
 *     `now()` on every write, and the document list is ordered by it, so a
 *     backfill that let the trigger fire would reshuffle every list in the app.
 *     The original value is read first and written back explicitly.
 *   * `body_text` and `headings` are derived in the database by the same
 *     trigger, so they stay consistent with whatever wrote the row.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... pnpm backfill:markdown [--apply]
 *
 * Without `--apply` it is a dry run: it reports what would change and which
 * documents fail the gate, and writes nothing.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { normalize, serialize, tiptapToMarkdown } from "@/lib/markdown";
import { aqliSchema } from "@/lib/markdown/schema";

type DocRow = {
  id: string;
  title: string;
  updated_at: string;
  body_json: Record<string, unknown> | null;
  body_md: string | null;
};

type Outcome = {
  id: string;
  title: string;
  status: "converted" | "unchanged" | "skipped-no-json" | "failed-gate" | "error";
  before: number;
  after: number;
  detail?: string;
};

/**
 * The gate: markdown regenerated from `body_json` must be a fixed point.
 *
 * Serializing the document is not enough on its own — the question is whether
 * the markdown survives being read back, because that is what every future edit
 * cycle does.
 */
function checkRoundTrip(markdown: string): { ok: boolean; detail?: string } {
  try {
    const once = normalize(markdown);
    const twice = normalize(once);
    if (once !== twice) {
      return { ok: false, detail: "not a fixed point after one normalization pass" };
    }
    if (once !== markdown) {
      // Serializer output that is not already normalized means the serializer
      // and the parser disagree, which is a defect rather than a document
      // problem. Surfaced explicitly rather than silently normalized away.
      return { ok: false, detail: "serializer output is not already normalized" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required.");
    process.exitCode = 2;
    return;
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await db
    .from("docs")
    .select("id, title, updated_at, body_json, body_md")
    .order("created_at", { ascending: true });

  if (error) throw error;
  const docs = (data ?? []) as DocRow[];

  const outcomes: Outcome[] = [];

  for (const doc of docs) {
    const before = doc.body_md?.length ?? 0;

    if (!doc.body_json) {
      outcomes.push({
        id: doc.id,
        title: doc.title,
        status: "skipped-no-json",
        before,
        after: before,
      });
      continue;
    }

    let markdown: string;
    try {
      markdown = tiptapToMarkdown(doc.body_json);
    } catch (cause) {
      outcomes.push({
        id: doc.id,
        title: doc.title,
        status: "error",
        before,
        after: before,
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      continue;
    }

    const gate = checkRoundTrip(markdown);
    if (!gate.ok) {
      outcomes.push({
        id: doc.id,
        title: doc.title,
        status: "failed-gate",
        before,
        after: markdown.length,
        detail: gate.detail,
      });
      continue;
    }

    if (markdown === doc.body_md) {
      outcomes.push({ id: doc.id, title: doc.title, status: "unchanged", before, after: markdown.length });
      continue;
    }

    if (apply) {
      // `updated_at` is written back explicitly so the trigger's `now()` does
      // not surface this backfill as an edit.
      const { error: writeError } = await db
        .from("docs")
        .update({ body_md: markdown, updated_at: doc.updated_at })
        .eq("id", doc.id);
      if (writeError) {
        outcomes.push({
          id: doc.id,
          title: doc.title,
          status: "error",
          before,
          after: markdown.length,
          detail: writeError.message,
        });
        continue;
      }
    }

    outcomes.push({ id: doc.id, title: doc.title, status: "converted", before, after: markdown.length });
  }

  const count = (status: Outcome["status"]) => outcomes.filter((o) => o.status === status).length;
  const failures = outcomes.filter((o) => o.status === "failed-gate" || o.status === "error");

  const lines = [
    "# Markdown backfill report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${apply ? "apply" : "dry run"}`,
    "",
    "| Outcome | Documents |",
    "|---|---|",
    `| Converted | ${count("converted")} |`,
    `| Already identical | ${count("unchanged")} |`,
    `| No body_json to convert | ${count("skipped-no-json")} |`,
    `| Failed the round-trip gate | ${count("failed-gate")} |`,
    `| Errored | ${count("error")} |`,
    `| **Total** | **${outcomes.length}** |`,
    "",
    `Editor schema: ${Object.keys(aqliSchema.nodes).length} nodes, ${Object.keys(aqliSchema.marks).length} marks.`,
    "",
  ];

  if (failures.length > 0) {
    lines.push("## Documents skipped", "", "| Id | Title | Status | Detail |", "|---|---|---|---|");
    for (const f of failures) {
      lines.push(`| ${f.id} | ${f.title.replace(/\|/g, "\\|")} | ${f.status} | ${f.detail ?? ""} |`);
    }
    lines.push("");
  } else {
    lines.push("Every document with a `body_json` passed the round-trip gate.", "");
  }

  const outPath = resolve("reports/markdown-backfill.md");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, lines.join("\n"), "utf8");

  console.log(`documents:   ${outcomes.length}`);
  console.log(`converted:   ${count("converted")}${apply ? "" : " (dry run — nothing written)"}`);
  console.log(`unchanged:   ${count("unchanged")}`);
  console.log(`no body_json:${count("skipped-no-json")}`);
  console.log(`failed gate: ${count("failed-gate")}`);
  console.log(`errored:     ${count("error")}`);
  console.log(`report:      ${outPath}`);

  if (failures.length > 0) process.exitCode = 1;
}

void main();

export { checkRoundTrip, serialize };
