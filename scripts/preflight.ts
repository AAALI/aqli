/**
 * `pnpm preflight` — is this installation in the state the code expects?
 *
 * The checks live in the database (`app.preflight`, 20260810000000) so that
 * this script and Settings → Health cannot disagree. This file is the
 * terminal rendering of that report, plus the two things a database cannot see
 * for itself: the deployment's environment variables and whether the auth
 * service still has email confirmation switched off.
 *
 * Usage:
 *   pnpm preflight                 # reads .env.local when the vars are unset
 *   pnpm preflight --json          # the raw findings, for CI
 *
 * Exit code is 1 when anything failed, so it can gate a deploy. Warnings do
 * not fail the run: "you have not set OPENAI_API_KEY" is worth saying and not
 * worth stopping for.
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildChecks, overall, readAuthSettings, EXPECTED_MIGRATION_VERSIONS } from "@/lib/preflight";
import type { Check, DbReport } from "@/lib/preflight";

/**
 * Load `.env.local` without adding a dependency for it.
 *
 * Real environment variables win: a deployment that sets them meant it, and a
 * stale local file should never quietly describe a different database than the
 * one being checked.
 */
async function loadEnvFile(): Promise<void> {
  try {
    const text = await readFile(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // No file is the normal case in CI and in a deployed environment.
  }
}

const ICON: Record<Check["status"], string> = { ok: "✓", warn: "!", fail: "✗" };

function render(checks: Check[]): void {
  const width = Math.max(...checks.map((c) => c.title.length));
  for (const check of checks) {
    console.log(`${ICON[check.status]} ${check.title.padEnd(width)}  ${check.detail}`);
    if (check.fix && check.status !== "ok") console.log(`${" ".repeat(width + 4)}→ ${check.fix}`);
  }
}

async function main(): Promise<void> {
  await loadEnvFile();

  const json = process.argv.includes("--json");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    console.error("preflight needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY.");
    console.error("The report reads the catalogue and every workspace's counts, so it runs as the service role.");
    process.exit(1);
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await db.rpc("preflight_report", {
    p_expected_migrations: EXPECTED_MIGRATION_VERSIONS,
  });

  const auth = await readAuthSettings(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const checks = buildChecks({
    db: (data as DbReport | null) ?? null,
    dbError: error?.message,
    env: process.env as Record<string, string | undefined>,
    auth,
    production: process.env.NODE_ENV === "production" || process.env.AQLI_ENV === "production",
  });

  if (json) {
    console.log(JSON.stringify({ status: overall(checks), checks }, null, 2));
  } else {
    console.log(`\nAqli preflight — ${url}\n`);
    render(checks);
    const status = overall(checks);
    console.log(
      `\n${
        status === "ok"
          ? "Everything the code expects is in place."
          : status === "warn"
            ? "Usable, with the warnings above."
            : "Fix the failures above before inviting anyone."
      }\n`,
    );
  }

  process.exit(overall(checks) === "fail" ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
