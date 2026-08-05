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
  // predicate is a cross-tenant read that nothing will stop. `lib/db` is the
  // only place allowed to build one; everywhere else goes through `scoped()`
  // or `withWorkspace()`, which append the predicate whether or not anyone
  // remembered to. `unscoped(reason)` is the documented escape hatch for the
  // queries that genuinely cannot be scoped.
  //
  // This turns a discipline problem into a lint error.
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["lib/db/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db/client",
              message:
                "Service-role clients are built only in lib/db. Use `scoped(workspaceId)` or `withWorkspace()` from @/lib/db, or `unscoped(reason)` if the query truly cannot be workspace-scoped.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/db/client", "./client", "../client"],
              importNames: ["rawServiceClient"],
              message:
                "rawServiceClient is internal to lib/db. Use `scoped(workspaceId)` or `withWorkspace()` from @/lib/db.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
