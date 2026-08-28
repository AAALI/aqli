import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { EXPECTED_MIGRATIONS, migrationFileName } from "../migrations";

/**
 * The health page cannot read `supabase/migrations/` — it runs on a Worker —
 * so the list is checked in. This is what keeps the copy honest: add a
 * migration without updating the list and the failure is here, not in an
 * installation that quietly stops noticing the newest one.
 */
describe("EXPECTED_MIGRATIONS", () => {
  const onDisk = readdirSync(resolve(__dirname, "../../../supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => {
      const base = file.replace(/\.sql$/, "");
      const version = base.slice(0, base.indexOf("_"));
      return { version, name: base.slice(version.length + 1) };
    });

  it("matches the migrations folder", () => {
    const replacement = onDisk
      .map((m) => `  { version: "${m.version}", name: "${m.name}" },`)
      .join("\n");
    expect(EXPECTED_MIGRATIONS, `replace EXPECTED_MIGRATIONS with:\n${replacement}`).toEqual(onDisk);
  });

  it("is ordered, since that is the order the files apply in", () => {
    const versions = EXPECTED_MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort());
  });

  it("resolves a version back to a filename for error messages", () => {
    expect(migrationFileName("20260808000000")).toBe("20260808000000_doc_comments.sql");
    // An unknown version is echoed rather than guessed at: it comes from a
    // database that is ahead of this checkout.
    expect(migrationFileName("29990101000000")).toBe("29990101000000");
  });
});
