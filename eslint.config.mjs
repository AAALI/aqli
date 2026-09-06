import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated deploy artifacts (OpenNext / Cloudflare adapter output).
    ".open-next/**",
    // Design handoff bundle — reference prototypes, not app source.
    "aqli_Design_Handoff/**",
  ]),

  // Spec §2.4 — close the service-role footgun.
  //
  // The service role bypasses RLS, so a query that forgets its `workspace_id`
  // predicate is a cross-tenant read that nothing will stop. `src/lib/db` is the
  // only place allowed to build one; everywhere else goes through `scoped()`
  // or `withWorkspace()`, which append the predicate whether or not anyone
  // remembered to. `unscoped(reason)` is the documented escape hatch for the
  // queries that genuinely cannot be scoped.
  //
  // This turns a discipline problem into a lint error.
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/lib/db/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db/client",
              message:
                "Service-role clients are built only in src/lib/db. Use `scoped(workspaceId)` or `withWorkspace()` from @/lib/db, or `unscoped(reason)` if the query truly cannot be workspace-scoped.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/db/client", "./client", "../client"],
              importNames: ["rawServiceClient"],
              message:
                "rawServiceClient is internal to src/lib/db. Use `scoped(workspaceId)` or `withWorkspace()` from @/lib/db.",
            },
          ],
        },
      ],
    },
  },

  // Spec §4.1 — one schema, not two.
  //
  // `src/lib/markdown/schema.ts` is the allowlist: the editor mounts it and the
  // serializer is asserted complete against it, so a node the editor can
  // produce always has a markdown spelling. Building a separate extension list
  // silently breaks that pairing in both directions, and it had: the doc editor
  // and the read view each mounted a hand-rolled StarterKit with no table,
  // image or task list. A document containing any of them failed to load, and —
  // with `body_md` canonical — the next autosave wrote back markdown with the
  // content deleted.
  //
  // Same trick as above: make the invariant a lint error rather than a habit.
  //
  // Flat config resolves one `no-restricted-imports` per file, last match
  // winning, so this block has to restate the service-role paths rather than
  // just add to them — and it has to ignore `src/lib/db/**` as well, or it would
  // re-impose on `src/lib/db` the very rule the block above exempts it from.
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/lib/db/**", "src/lib/markdown/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db/client",
              message:
                "Service-role clients are built only in src/lib/db. Use `scoped(workspaceId)` or `withWorkspace()` from @/lib/db, or `unscoped(reason)` if the query truly cannot be workspace-scoped.",
            },
            {
              name: "@tiptap/starter-kit",
              message:
                "Mount `aqliExtensions()` from @/lib/markdown/schema instead. StarterKit enables nodes and marks (underline, and no table/image/task list) that the markdown serializer cannot round-trip, and body_md is canonical.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/db/client", "./client", "../client"],
              importNames: ["rawServiceClient"],
              message:
                "rawServiceClient is internal to src/lib/db. Use `scoped(workspaceId)` or `withWorkspace()` from @/lib/db.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
