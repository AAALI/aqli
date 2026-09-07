import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import { markdownZipSource } from "@/lib/import/sources/markdown-zip";
import { importDeps } from "@/lib/import/db";
import { runImport } from "@/lib/import/pipeline";
import { renderImportReport } from "@/lib/import/report";
import { proposeAgentDoc } from "@/lib/supabase/agent-docs";

/**
 * Import a zip of markdown, from the browser.
 *
 * The CLI covers exports a request cannot carry — a Confluence space export is
 * hundreds of megabytes across a directory of CSVs and attachments. This covers
 * everything else, because a customer on a hosted instance has no shell, and
 * "send us your zip" is not a migration path. Both surfaces run the same
 * pipeline: there is one importer, with two ways in.
 */
export const dynamic = "force-dynamic";

/**
 * Comfortably inside what a Worker request will carry, and far below the point
 * where an import should have been a CLI run anyway. The message says which.
 */
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const workspaceId = String(form?.get("workspace_id") ?? "");
  const defaultSpaceId = (form?.get("default_space_id") as string | null) || null;
  const apply = form?.get("apply") === "true";

  if (!workspaceId || !(file instanceof File)) {
    return NextResponse.json({ error: "workspace_id and a zip file are required" }, { status: 400 });
  }

  // Importing writes documents across a whole workspace. That is an admin's
  // decision, and the same rule as Settings → Health.
  const role = await getMyRole(workspaceId);
  if (role !== "admin") {
    return NextResponse.json({ error: "Only workspace admins can import" }, { status: 403 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error:
          `That archive is ${Math.round(file.size / (1024 * 1024))} MB. The browser import takes ` +
          `up to ${MAX_BYTES / (1024 * 1024)} MB — use \`pnpm import\` for anything larger.`,
      },
      { status: 413 },
    );
  }

  let source;
  try {
    source = markdownZipSource(new Uint8Array(await file.arrayBuffer()), `zip:${file.name}`);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "That file could not be read as a zip" },
      { status: 400 },
    );
  }

  const report = await runImport(
    source,
    importDeps({ workspaceId, spaceMap: {}, authorMap: {}, defaultSpaceId }),
    {
      workspaceId,
      docHref: (id) => `/docs/${id}`,
      dryRun: !apply,
    },
  );

  const markdown = renderImportReport(report, (id) => `/docs/${id}`);

  // The report belongs where the team is, not in a download nobody opens
  // again: the cleanup pass is a checklist, and this is the checklist.
  let reportDocId: string | null = null;
  if (apply) {
    const created = await proposeAgentDoc({
      workspaceId,
      agentKeyId: null,
      origin: "system",
      spaceId: defaultSpaceId,
      title: `Import report — ${file.name}`,
      bodyMd: markdown,
      type: "general",
      status: "draft",
      frontmatter: { tags: ["import"] },
      rationale: "Import report",
      trusted: true,
    }).catch(() => null);
    reportDocId = created?.doc?.id ?? null;
  }

  return NextResponse.json({
    summary: {
      pages: report.pages.length,
      created: report.pages.filter((p) => p.status === "created").length,
      updated: report.pages.filter((p) => p.status === "updated").length,
      failed: report.pages.filter((p) => p.status === "failed").length,
      dryRun: report.dryRun,
    },
    report: markdown,
    report_doc_id: reportDocId,
  });
}
