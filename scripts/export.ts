/**
 * `pnpm export` — the whole workspace as markdown and images.
 *
 * The CLI half of the exit door. Settings → Import & export has the same thing
 * behind a button; this is for a backup that runs on a schedule, and for the
 * one an operator takes before a cutover.
 *
 * Usage:
 *   pnpm export --workspace <slug> [--out acme.zip]
 *
 * The archive is deterministic: two exports of unchanged content are
 * byte-identical, so `sha256sum` tells you whether anything moved.
 */
import { createWriteStream } from "node:fs";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createClient } from "@supabase/supabase-js";
import { workspaceExport } from "@/lib/export/db";
import { zipStream } from "@/lib/export/zip-writer";

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

async function main(): Promise<void> {
  await loadEnvFile();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    console.error("export needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY.");
    process.exit(1);
  }

  const slug = arg("workspace");
  if (!slug) {
    console.error("usage: pnpm export --workspace <slug> [--out file.zip]");
    process.exit(1);
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: workspace } = await db.from("workspaces").select("id, slug").eq("slug", slug).single();
  if (!workspace) {
    console.error(`no workspace with slug "${slug}"`);
    process.exit(1);
  }

  const outPath = resolve(arg("out") ?? `${workspace.slug}-${new Date().toISOString().slice(0, 10)}.zip`);
  await mkdir(dirname(outPath), { recursive: true });

  const files = await workspaceExport(workspace.id);
  await pipeline(
    Readable.fromWeb(zipStream(files) as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(outPath),
  );

  console.log(`Exported ${workspace.slug} → ${outPath}`);
  console.log("Markdown and images. It imports back with `pnpm import --zip`.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
