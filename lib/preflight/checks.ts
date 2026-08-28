/**
 * Turn the database's preflight report into a list of named problems.
 *
 * Deliberately pure: it takes the report, the environment and the auth
 * settings as plain values and returns findings. Both callers — the CLI and
 * Settings → Health — render the same list, and the whole thing is testable
 * without a database, which is what keeps the wording of a fix honest.
 *
 * Every finding that is not `ok` carries a fix. A report that says something
 * is wrong without saying what to do about it is a slower way of saying
 * nothing, and the audience here is a self-hoster who has never read this
 * repository.
 */
import { EXPECTED_MIGRATIONS, EXPECTED_MIGRATION_VERSIONS, migrationFileName } from "./migrations";

export type Severity = "ok" | "warn" | "fail";

export type Check = {
  id: string;
  title: string;
  status: Severity;
  detail: string;
  fix?: string;
};

/** The shape `public.preflight_report` returns. */
export type DbReport = {
  generated_at: string;
  migrations:
    | { tracked: false }
    | { tracked: true; applied_count: number; missing: string[]; unknown: string[] };
  rls: { disabled: string[]; enabled_without_policies: string[] };
  gates: Record<string, { recorded_at: string; detail: Record<string, unknown> }>;
  markdown: { body_md_required: boolean; at_risk_docs: number; docs: number };
  retrieval: {
    chunks_table: boolean;
    search_function: boolean;
    vector_extension: boolean;
    approved_without_chunks: number | null;
  };
  storage: { exists: boolean; public?: boolean; policies?: number } | null;
};

export type PreflightInput = {
  /** Null when the report could not be read at all. */
  db: DbReport | null;
  dbError?: string;
  env: Record<string, string | undefined>;
  /** From GoTrue's `/auth/v1/settings`; null when it could not be read. */
  auth?: { mailerAutoconfirm: boolean | null };
  /** Production holds a couple of checks to a higher standard than a laptop. */
  production?: boolean;
};

const list = (items: string[]) => items.join(", ");

/**
 * The migration that most likely owns a table, by name.
 *
 * `doc_comments` is closed by `20260808000000_doc_comments.sql`, and the
 * convention holds across the folder. A guess, so the wording says "named
 * after it" rather than asserting — but a named file is what turns "RLS is off
 * on doc_comments" into something an operator can act on without reading the
 * repository.
 */
function migrationNamedAfter(table: string): string | undefined {
  const exact = EXPECTED_MIGRATIONS.find((m) => m.name === table);
  return exact ? `${exact.version}_${exact.name}.sql` : undefined;
}

/**
 * `AQLI_MERGE_ENGINE` is off unless explicitly set to `0`/`false` — the same
 * reading `lib/flags.ts` uses. Duplicated rather than imported because that
 * module reads `process.env` directly and this one is handed an environment.
 */
function mergeEngineOff(env: Record<string, string | undefined>): boolean {
  const v = env.AQLI_MERGE_ENGINE;
  return v === "0" || v === "false";
}

export function buildChecks(input: PreflightInput): Check[] {
  const { db, env } = input;
  const checks: Check[] = [];

  // --- can we see the database at all -------------------------------------
  if (!db) {
    return [
      {
        id: "database",
        title: "Preflight report",
        status: "fail",
        detail: input.dbError
          ? `Could not read the report: ${input.dbError}`
          : "Could not read the report.",
        fix:
          "The report is a database function, so a database that is behind cannot describe itself. " +
          "Apply everything in supabase/migrations/ (the function ships in 20260810000000_preflight.sql) and run this again.",
      },
    ];
  }

  checks.push({
    id: "database",
    title: "Preflight report",
    status: "ok",
    detail: `Read at ${new Date(db.generated_at).toISOString()}.`,
  });

  // --- migrations ----------------------------------------------------------
  if (!db.migrations.tracked) {
    checks.push({
      id: "migrations",
      title: "Migrations",
      status: "warn",
      detail:
        "This database has no supabase_migrations.schema_migrations ledger, so applied migrations cannot be listed.",
      fix: "Expected on a hand-migrated database. If you use the Supabase CLI, this table should exist — check you are pointed at the project you think you are.",
    });
  } else {
    const { missing, unknown } = db.migrations;
    if (missing.length > 0) {
      checks.push({
        id: "migrations",
        title: "Migrations",
        status: "fail",
        detail: `${missing.length} migration(s) in this checkout have not been applied: ${list(missing.map(migrationFileName))}.`,
        fix: "Apply them (supabase db push, or run the files in order). Some of them close holes rather than add features.",
      });
    } else if (unknown.length > 0) {
      checks.push({
        id: "migrations",
        title: "Migrations",
        status: "warn",
        detail: `Applied but not in this checkout: ${list(unknown)}. The database is ahead of the code.`,
        fix: "Deploy the matching version of the app, or confirm the extra migrations are yours.",
      });
    } else {
      checks.push({
        id: "migrations",
        title: "Migrations",
        status: "ok",
        detail: `All ${EXPECTED_MIGRATION_VERSIONS.length} applied.`,
      });
    }
  }

  // --- row-level security --------------------------------------------------
  //
  // The one check that is a live data-exposure bug rather than a misconfigured
  // feature: a public table with RLS off is served in full by PostgREST to any
  // authenticated user, whatever workspace they belong to.
  if (db.rls.disabled.length > 0) {
    const named = db.rls.disabled
      .map((table) => {
        const file = migrationNamedAfter(table);
        return file ? `${table} (see ${file})` : table;
      })
      .join(", ");
    checks.push({
      id: "rls",
      title: "Row-level security",
      status: "fail",
      detail: `RLS is disabled on: ${named}. PostgREST applies no restriction to these, so any signed-in user can read every workspace's rows.`,
      fix: "Apply the migration named after each table, then re-run. Do not invite anyone until this is clear.",
    });
  } else if (db.rls.enabled_without_policies.length > 0) {
    checks.push({
      id: "rls",
      title: "Row-level security",
      status: "warn",
      detail: `RLS is on but no policy exists for: ${list(db.rls.enabled_without_policies)}. Nothing can read them except the service role.`,
      fix: "Deliberate for service-role-only tables. Otherwise a migration landed halfway.",
    });
  } else {
    checks.push({
      id: "rls",
      title: "Row-level security",
      status: "ok",
      detail: "Every public table has RLS on with at least one policy.",
    });
  }

  // --- markdown canonical --------------------------------------------------
  if (db.markdown.at_risk_docs > 0) {
    checks.push({
      id: "markdown",
      title: "Canonical markdown",
      status: "fail",
      detail: `${db.markdown.at_risk_docs} document(s) have content in body_json and nothing in body_md. Those documents read as empty.`,
      fix: "Run pnpm backfill:markdown (dry run first), which regenerates body_md from body_json.",
    });
  } else if (!db.markdown.body_md_required) {
    checks.push({
      id: "markdown",
      title: "Canonical markdown",
      status: "warn",
      detail:
        "body_md is still nullable, so the step-6 flip has not been applied and body_json is still the source of truth.",
      fix: "Follow the deploy order in reports/HANDOVER.md: backfill, then 20260805040000_body_md_canonical.sql. Until then a markdown export is not lossless.",
    });
  } else {
    checks.push({
      id: "markdown",
      title: "Canonical markdown",
      status: "ok",
      detail: `body_md is canonical across ${db.markdown.docs} document(s).`,
    });
  }

  // --- merge engine --------------------------------------------------------
  if (mergeEngineOff(env)) {
    checks.push({
      id: "merge-engine",
      title: "Merge engine",
      status: "warn",
      detail: "AQLI_MERGE_ENGINE is off, so saves write docs directly and produce no revision.",
      fix: "That switch is a rollback lever, not a mode: history has a hole for anything edited while it is off. Drop it from the environment.",
    });
  } else {
    checks.push({
      id: "merge-engine",
      title: "Merge engine",
      status: "ok",
      detail: "Saves go through propose → merge, so every change writes a revision.",
    });
  }

  // --- retrieval -----------------------------------------------------------
  const r = db.retrieval;
  if (!r.vector_extension || !r.chunks_table || !r.search_function) {
    const absent = [
      !r.vector_extension && "the vector extension",
      !r.chunks_table && "the doc_chunks table",
      !r.search_function && "search_doc_chunks()",
    ].filter(Boolean) as string[];
    checks.push({
      id: "retrieval",
      title: "Retrieval",
      status: "fail",
      detail: `Missing ${list(absent)}. Ask and every assistant search return nothing.`,
      fix: "Enable pgvector on the project and apply the migrations that create the chunk table and search function.",
    });
  } else if ((r.approved_without_chunks ?? 0) > 0) {
    checks.push({
      id: "retrieval",
      title: "Retrieval",
      status: "warn",
      detail: `${r.approved_without_chunks} approved document(s) have no embeddings, so no assistant can find them.`,
      fix: env.OPENAI_API_KEY
        ? "Re-save those documents, or re-run embedding for them. New saves embed automatically."
        : "OPENAI_API_KEY is not set, so nothing can be embedded. Set it, then re-save the documents.",
    });
  } else {
    checks.push({
      id: "retrieval",
      title: "Retrieval",
      status: "ok",
      detail: "Every approved document is embedded and searchable.",
    });
  }

  // --- storage -------------------------------------------------------------
  if (!db.storage || !db.storage.exists) {
    checks.push({
      id: "storage",
      title: "Image storage",
      status: "fail",
      detail: "The doc-images bucket does not exist, so pasting a screenshot fails.",
      fix: "Apply 20260806010000_doc_images_storage.sql.",
    });
  } else if (db.storage.public) {
    checks.push({
      id: "storage",
      title: "Image storage",
      status: "fail",
      detail: "The doc-images bucket is public: every image is readable by anyone with the URL, regardless of workspace.",
      fix: "Set the bucket private. Images are served through the authenticated /api/images route, so nothing needs public access.",
    });
  } else {
    checks.push({
      id: "storage",
      title: "Image storage",
      status: "ok",
      detail: `The doc-images bucket is private with ${db.storage.policies ?? 0} policies.`,
    });
  }

  // --- environment ---------------------------------------------------------
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const missingRequired = required.filter((k) => !env[k]);
  const optional: Array<[string, string]> = [
    ["OPENAI_API_KEY", "Ask, summaries and assistant search are off without it."],
    ["NEXT_PUBLIC_APP_URL", "Links in agent and MCP results have no host to point at."],
  ];
  const missingOptional = optional.filter(([k]) => !env[k]);

  if (missingRequired.length > 0) {
    checks.push({
      id: "env",
      title: "Environment",
      status: "fail",
      detail: `Not set: ${list(missingRequired)}. The app cannot reach Supabase without them.`,
      fix: "Set them in the deployment environment (see .env.example).",
    });
  } else if (missingOptional.length > 0) {
    checks.push({
      id: "env",
      title: "Environment",
      status: "warn",
      detail: missingOptional.map(([k, why]) => `${k} is not set. ${why}`).join(" "),
      fix: "Set them if you want those features on.",
    });
  } else {
    checks.push({ id: "env", title: "Environment", status: "ok", detail: "Every variable the app reads is set." });
  }

  // --- email confirmation --------------------------------------------------
  //
  // With autoconfirm on, signup hands out a session for an address nobody
  // proved they own. That is the documented local-development setting, and
  // exactly the one people forget to reverse.
  if (input.auth) {
    if (input.auth.mailerAutoconfirm === null) {
      checks.push({
        id: "email-confirmation",
        title: "Email confirmation",
        status: "warn",
        detail: "Could not read the auth settings for this project.",
        fix: "Check Supabase → Auth → Providers by hand: email confirmation should be on in production.",
      });
    } else if (input.auth.mailerAutoconfirm) {
      checks.push({
        id: "email-confirmation",
        title: "Email confirmation",
        status: input.production ? "fail" : "warn",
        detail: "Email confirmation is off: anyone can sign up as any address and get a session immediately.",
        fix: input.production
          ? "Turn on Confirm email in Supabase → Auth → Providers. The README's note about disabling it is for local development."
          : "Fine for local development. Turn it on before anyone else signs up.",
      });
    } else {
      checks.push({
        id: "email-confirmation",
        title: "Email confirmation",
        status: "ok",
        detail: "New signups must confirm their address.",
      });
    }
  }

  return checks;
}

/** The worst status present — what the CLI exits on and the page leads with. */
export function overall(checks: Check[]): Severity {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "warn")) return "warn";
  return "ok";
}
