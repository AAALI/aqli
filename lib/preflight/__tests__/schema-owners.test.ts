import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SCHEMA_OWNERS } from "../schema-owners";
import { EXPECTED_MIGRATIONS } from "../migrations";

/**
 * `SCHEMA_OWNERS` is checked in because the drift screen runs on a Worker with
 * no filesystem. This re-derives it from the folder and fails with the
 * replacement text, so adding a migration that creates a table cannot silently
 * leave the screen unable to name it — the same guard `migrations.test.ts`
 * puts on EXPECTED_MIGRATIONS.
 */
const DIR = resolve(__dirname, "../../../supabase/migrations");

/** Column names that identify nothing on their own. See schema-owners.ts. */
const NOISE = new Set([
  "workspace_id",
  "position",
  "scopes",
  "origin",
  "mentions",
  "visibility",
  "headings",
  "body_json",
  "body_text",
]);

function derive(): Record<string, string> {
  const owners: Record<string, string> = {};
  const files = readdirSync(DIR)
    .filter((f) => /^2026.*\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const base = file.replace(/\.sql$/, "");
    const sql = readFileSync(resolve(DIR, file), "utf8");
    const objects = new Set<string>();

    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi)) {
      objects.add(m[1].split(".").pop()!);
    }
    for (const m of sql.matchAll(/create\s+or\s+replace\s+function\s+([\w.]+)/gi)) {
      objects.add(m[1]);
      objects.add(m[1].split(".").pop()!);
    }
    for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?([\w.]+)([\s\S]*?);/gi)) {
      const table = m[1].split(".").pop()!;
      for (const c of m[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/gi)) {
        objects.add(`${table}.${c[1]}`);
        objects.add(c[1]);
      }
    }

    for (const object of objects) {
      if (NOISE.has(object)) continue;
      // Earliest wins: that is the migration whose absence explains the error.
      owners[object] ??= base;
    }
  }
  return owners;
}

describe("SCHEMA_OWNERS", () => {
  it("matches the migrations folder", () => {
    const derived = derive();
    const replacement = Object.keys(derived)
      .sort()
      .map((k) => `  "${k}": "${derived[k]}",`)
      .join("\n");
    expect(
      SCHEMA_OWNERS,
      `replace SCHEMA_OWNERS with:\n${replacement}`,
    ).toEqual(derived);
  });

  it("only names migrations this checkout has", () => {
    const known = new Set(EXPECTED_MIGRATIONS.map((m) => `${m.version}_${m.name}`));
    for (const [object, migration] of Object.entries(SCHEMA_OWNERS)) {
      expect(known, `${object} points at a migration that is not in the folder`).toContain(
        migration,
      );
    }
  });
});
