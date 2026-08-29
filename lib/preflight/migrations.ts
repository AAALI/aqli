/**
 * Every migration this checkout expects a database to have applied.
 *
 * The list is here rather than read from disk because the health page runs on
 * a Worker, where there is no filesystem to read `supabase/migrations/` from.
 * `migrations.test.ts` compares this against the folder and fails with the
 * exact replacement text, so drift is a red test rather than a health page
 * that quietly stops noticing the newest migration.
 */
export type ExpectedMigration = { version: string; name: string };

export const EXPECTED_MIGRATIONS: ExpectedMigration[] = [
  { version: "20260608000000", name: "integration_connections" },
  { version: "20260609191505", name: "integration_webhook_events" },
  { version: "20260610000000", name: "integration_connections_workspace_scope" },
  { version: "20260610002000", name: "integration_webhook_pr_merge_dedupe" },
  { version: "20260613000000", name: "invitations" },
  { version: "20260620000000", name: "member_full_name" },
  { version: "20260711000000", name: "workspaces_admin_update" },
  { version: "20260711010000", name: "member_management_rpcs" },
  { version: "20260716000000", name: "default_company_space_only" },
  { version: "20260805000000", name: "markdown_canonical_schema" },
  { version: "20260805010000", name: "backfill_revisions" },
  { version: "20260805020000", name: "docs_updated_at_explicit" },
  { version: "20260805030000", name: "merge_engine" },
  { version: "20260805035000", name: "migration_gates" },
  { version: "20260805040000", name: "body_md_canonical" },
  { version: "20260806000000", name: "md_to_text_fidelity" },
  { version: "20260806010000", name: "doc_images_storage" },
  { version: "20260806020000", name: "doc_images_require_doc_segment" },
  { version: "20260808000000", name: "doc_comments" },
  { version: "20260809000000", name: "github_direct_tokens" },
  { version: "20260810000000", name: "preflight" },
  { version: "20260811000000", name: "doc_tree" },
  { version: "20260812000000", name: "import_source_ref" },
  { version: "20260813000000", name: "space_permissions" },
];

/** Just the versions, which is what the database ledger stores. */
export const EXPECTED_MIGRATION_VERSIONS: string[] = EXPECTED_MIGRATIONS.map((m) => m.version);

/** `20260808000000` → `20260808000000_doc_comments.sql`, for error messages. */
export function migrationFileName(version: string): string {
  const found = EXPECTED_MIGRATIONS.find((m) => m.version === version);
  return found ? `${found.version}_${found.name}.sql` : version;
}
