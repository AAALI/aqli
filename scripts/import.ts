/**
 * `pnpm import` — bring an existing wiki into a workspace.
 *
 * The CLI half of F-1. It exists for the exports a browser upload cannot
 * reasonably carry: a Confluence space export is hundreds of megabytes across a
 * directory of CSVs and attachments, and a Worker request is not where that
 * belongs. The admin upload (Settings → Import) runs the same pipeline for the
 * markdown and zip cases a person can drag onto a page.
 *
 * Usage:
 *   pnpm import --workspace <slug> --dir  path/to/unzipped-confluence-export
 *   pnpm import --workspace <slug> --zip  path/to/markdown.zip
 *
 *   --space-map hr=handbook,eng=engineering   source space key → Aqli space slug
 *   --default-space handbook                  where unmapped pages go
 *   --authors path/to/user_mapping.csv        source user → email, matched to members
 *   --out reports/import.md                   where the report is written
 *   --apply                                   without it, nothing is written
 *
 * A dry run is the default, deliberately. The report it produces is the thing
 * to read before letting an import touch a workspace that people are using.
 */
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "@/lib/confluence/csv";
import { confluenceSource, type ExportFiles } from "@/lib/import/sources/confluence";
import { markdownZipSource } from "@/lib/import/sources/markdown-zip";
import { importDeps } from "@/lib/import/db";
import { runImport } from "@/lib/import/pipeline";
import { renderImportReport } from "@/lib/import/report";
import type { ImportSource } from "@/lib/import/types";

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

async function loadEnvFile(): Promise<void> {
  try {
    const text = await readFile(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Normal in CI and in a deployed environment.
  }
}

/** Every file under a directory, as paths relative to it. */
async function walk(root: string, at = root): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(at, { withFileTypes: true })) {
    const full = join(at, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(root, full)));
    else out.push(relative(root, full));
  }
  return out;
}

function directoryFiles(root: string, paths: string[]): ExportFiles {
  return {
    paths,
    rows: (path) => parseCsv(createReadStream(join(root, path), { encoding: "utf8", highWaterMark: 1 << 20 })),
    readBytes: async (path) => new Uint8Array(await readFile(join(root, path))),
  };
}

/** `hr=handbook,eng=engineering` → a map, once the slugs are resolved to ids. */
function parsePairs(value: string | undefined): Record<string, string> {
  if (!value) return {};
  const out: Record<string, string> = {};
  for (const pair of value.split(",")) {
    const [from, to] = pair.split("=").map((s) => s.trim());
    if (from && to) out[from] = to;
  }
  return out;
}

async function main(): Promise<void> {
  await loadEnvFile();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    console.error("import needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY.");
    process.exit(1);
  }

  const workspaceSlug = arg("workspace");
  const dir = arg("dir");
  const zip = arg("zip");
  const apply = process.argv.includes("--apply");

  if (!workspaceSlug || (!dir && !zip)) {
    console.error("usage: pnpm import --workspace <slug> (--dir <export dir> | --zip <file>) [--apply]");
    process.exit(1);
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: workspace, error: workspaceError } = await db
    .from("workspaces")
    .select("id, slug")
    .eq("slug", workspaceSlug)
    .single();
  if (workspaceError || !workspace) {
    console.error(`no workspace with slug "${workspaceSlug}"`);
    process.exit(1);
  }

  // Space slugs are what a person types; ids are what the importer needs.
  const { data: spaces } = await db.from("spaces").select("id, slug").eq("workspace_id", workspace.id);
  const spaceIdBySlug = new Map((spaces ?? []).map((s) => [s.slug as string, s.id as string]));

  const spaceMap: Record<string, string> = {};
  for (const [sourceKey, slug] of Object.entries(parsePairs(arg("space-map")))) {
    const id = spaceIdBySlug.get(slug);
    if (!id) {
      console.error(`--space-map names "${slug}", which is not a space in this workspace`);
      process.exit(1);
    }
    spaceMap[sourceKey] = id;
  }

  const defaultSpaceSlug = arg("default-space");
  const defaultSpaceId = defaultSpaceSlug ? (spaceIdBySlug.get(defaultSpaceSlug) ?? null) : null;
  if (defaultSpaceSlug && !defaultSpaceId) {
    console.error(`--default-space names "${defaultSpaceSlug}", which is not a space in this workspace`);
    process.exit(1);
  }

  // Authors: source username → email in the mapping file → member with that email.
  const authorMap: Record<string, string> = {};
  const authorsPath = arg("authors");
  if (authorsPath) {
    const { data: members } = await db
      .from("members")
      .select("user_id, email:users(email)")
      .eq("workspace_id", workspace.id);
    const idByEmail = new Map<string, string>();
    for (const member of (members ?? []) as { user_id: string; email?: { email?: string } | null }[]) {
      const email = member.email?.email;
      if (email) idByEmail.set(email.toLowerCase(), member.user_id);
    }

    let header: string[] | null = null;
    for await (const row of parseCsv(createReadStream(authorsPath, { encoding: "utf8" }))) {
      if (!header) {
        header = row.map((h) => h.trim().toLowerCase());
        continue;
      }
      const username = row[header.indexOf("username")] ?? row[0];
      const email = (row[header.indexOf("email")] ?? "").toLowerCase();
      const userId = idByEmail.get(email);
      if (username && userId) authorMap[username.trim()] = userId;
    }
  }

  let source: ImportSource;
  if (zip) {
    source = markdownZipSource(new Uint8Array(await readFile(zip)));
  } else {
    const root = resolve(dir!);
    source = await confluenceSource(directoryFiles(root, await walk(root)));
  }

  console.log(`${apply ? "Importing" : "Dry run"} from ${source.name} into ${workspace.slug}…\n`);

  let done = 0;
  const report = await runImport(
    source,
    importDeps({ workspaceId: workspace.id, spaceMap, authorMap, defaultSpaceId }),
    {
      workspaceId: workspace.id,
      docHref: (id) => `/w/${workspace.slug}/docs/${id}`,
      dryRun: !apply,
      onProgress: (outcome) => {
        done += 1;
        if (done % 25 === 0 || outcome.status === "failed") {
          console.log(`  ${done} pages — ${outcome.status}: ${outcome.title}`);
        }
      },
    },
  );

  const outPath = resolve(arg("out") ?? "reports/import.md");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, renderImportReport(report, (id) => `/w/${workspace.slug}/docs/${id}`), "utf8");

  const failed = report.pages.filter((p) => p.status === "failed").length;
  console.log(`\n${report.pages.length} pages, ${failed} failed. Report: ${outPath}`);
  if (!apply) console.log("Nothing was written. Re-run with --apply once the report reads right.");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
