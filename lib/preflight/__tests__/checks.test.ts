import { describe, it, expect } from "vitest";
import { buildChecks, overall } from "../checks";
import type { DbReport } from "../checks";

/** A database in the state the code expects, which each test then breaks. */
function healthyReport(over: Partial<DbReport> = {}): DbReport {
  return {
    generated_at: "2026-08-27T10:00:00.000Z",
    migrations: { tracked: true, applied_count: 21, missing: [], unknown: [] },
    rls: { disabled: [], enabled_without_policies: [] },
    gates: { body_md_backfill: { recorded_at: "2026-08-05T00:00:00.000Z", detail: {} } },
    markdown: { body_md_required: true, at_risk_docs: 0, docs: 27 },
    retrieval: {
      chunks_table: true,
      search_function: true,
      vector_extension: true,
      approved_without_chunks: 0,
    },
    storage: { exists: true, public: false, policies: 4 },
    ...over,
  };
}

const healthyEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  OPENAI_API_KEY: "sk-test",
  NEXT_PUBLIC_APP_URL: "https://aqli.example",
};

const find = (checks: ReturnType<typeof buildChecks>, id: string) => {
  const check = checks.find((c) => c.id === id);
  if (!check) throw new Error(`no check with id ${id}`);
  return check;
};

describe("buildChecks", () => {
  it("passes a database in the expected state", () => {
    const checks = buildChecks({
      db: healthyReport(),
      env: healthyEnv,
      auth: { mailerAutoconfirm: false },
    });
    expect(overall(checks)).toBe("ok");
    expect(checks.every((c) => c.status === "ok")).toBe(true);
  });

  it("fails when the report itself cannot be read, and says why that is expected", () => {
    const checks = buildChecks({ db: null, dbError: "function does not exist", env: healthyEnv });
    expect(overall(checks)).toBe("fail");
    // The failure mode this is for: the checks live in a migration, so a
    // database behind enough to be broken cannot describe itself.
    expect(find(checks, "database").fix).toContain("supabase/migrations");
  });

  it("fails on a table with RLS disabled", () => {
    const checks = buildChecks({
      db: healthyReport({ rls: { disabled: ["doc_comments"], enabled_without_policies: [] } }),
      env: healthyEnv,
    });
    const rls = find(checks, "rls");
    expect(rls.status).toBe("fail");
    expect(rls.detail).toContain("doc_comments");
    // Naming the file is the difference between a finding and an instruction.
    expect(rls.detail).toContain("20260808000000_doc_comments.sql");
    expect(overall(checks)).toBe("fail");
  });

  it("only warns when RLS is on but a table has no policies", () => {
    const checks = buildChecks({
      db: healthyReport({ rls: { disabled: [], enabled_without_policies: ["migration_gates"] } }),
      env: healthyEnv,
    });
    expect(find(checks, "rls").status).toBe("warn");
  });

  it("names the migration files that have not been applied", () => {
    const checks = buildChecks({
      db: healthyReport({
        migrations: { tracked: true, applied_count: 19, missing: ["20260808000000"], unknown: [] },
      }),
      env: healthyEnv,
    });
    const migrations = find(checks, "migrations");
    expect(migrations.status).toBe("fail");
    expect(migrations.detail).toContain("20260808000000_doc_comments.sql");
  });

  it("says it cannot tell when there is no migration ledger", () => {
    const checks = buildChecks({
      db: healthyReport({ migrations: { tracked: false } }),
      env: healthyEnv,
    });
    expect(find(checks, "migrations").status).toBe("warn");
  });

  it("warns when the database is ahead of the code", () => {
    const checks = buildChecks({
      db: healthyReport({
        migrations: { tracked: true, applied_count: 22, missing: [], unknown: ["29990101000000"] },
      }),
      env: healthyEnv,
    });
    expect(find(checks, "migrations").status).toBe("warn");
  });

  it("fails when documents have JSON content and empty markdown", () => {
    const checks = buildChecks({
      db: healthyReport({ markdown: { body_md_required: true, at_risk_docs: 1, docs: 27 } }),
      env: healthyEnv,
    });
    expect(find(checks, "markdown").status).toBe("fail");
    expect(find(checks, "markdown").fix).toContain("backfill:markdown");
  });

  it("warns while body_md is still nullable, because export is not lossless yet", () => {
    const checks = buildChecks({
      db: healthyReport({ markdown: { body_md_required: false, at_risk_docs: 0, docs: 27 } }),
      env: healthyEnv,
    });
    expect(find(checks, "markdown").status).toBe("warn");
  });

  it("warns when the merge engine is switched off", () => {
    const checks = buildChecks({
      db: healthyReport(),
      env: { ...healthyEnv, AQLI_MERGE_ENGINE: "0" },
    });
    const engine = find(checks, "merge-engine");
    expect(engine.status).toBe("warn");
    expect(engine.detail).toContain("no revision");
  });

  it("treats an unset merge-engine flag as on", () => {
    const checks = buildChecks({ db: healthyReport(), env: healthyEnv });
    expect(find(checks, "merge-engine").status).toBe("ok");
  });

  it("warns about approved documents nothing can retrieve, and points at the missing key", () => {
    const withKey = buildChecks({
      db: healthyReport({
        retrieval: { chunks_table: true, search_function: true, vector_extension: true, approved_without_chunks: 3 },
      }),
      env: healthyEnv,
    });
    expect(find(withKey, "retrieval").status).toBe("warn");
    expect(find(withKey, "retrieval").fix).toContain("Re-save");

    const withoutKey = buildChecks({
      db: healthyReport({
        retrieval: { chunks_table: true, search_function: true, vector_extension: true, approved_without_chunks: 3 },
      }),
      env: { ...healthyEnv, OPENAI_API_KEY: undefined },
    });
    expect(find(withoutKey, "retrieval").fix).toContain("OPENAI_API_KEY");
  });

  it("fails when retrieval infrastructure is missing entirely", () => {
    const checks = buildChecks({
      db: healthyReport({
        retrieval: { chunks_table: false, search_function: false, vector_extension: false, approved_without_chunks: null },
      }),
      env: healthyEnv,
    });
    expect(find(checks, "retrieval").status).toBe("fail");
  });

  it("fails on a public image bucket", () => {
    const checks = buildChecks({
      db: healthyReport({ storage: { exists: true, public: true, policies: 4 } }),
      env: healthyEnv,
    });
    expect(find(checks, "storage").status).toBe("fail");
    expect(find(checks, "storage").detail).toContain("readable by anyone");
  });

  it("fails when Supabase credentials are absent and only warns for optional ones", () => {
    const hard = buildChecks({
      db: healthyReport(),
      env: { NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" },
    });
    expect(find(hard, "env").status).toBe("fail");

    const soft = buildChecks({
      db: healthyReport(),
      env: { NEXT_PUBLIC_SUPABASE_URL: "u", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a" },
    });
    expect(find(soft, "env").status).toBe("warn");
    expect(find(soft, "env").detail).toContain("OPENAI_API_KEY");
  });

  it("fails on autoconfirmed signups in production and only warns locally", () => {
    const prod = buildChecks({
      db: healthyReport(),
      env: healthyEnv,
      auth: { mailerAutoconfirm: true },
      production: true,
    });
    expect(find(prod, "email-confirmation").status).toBe("fail");

    const dev = buildChecks({
      db: healthyReport(),
      env: healthyEnv,
      auth: { mailerAutoconfirm: true },
    });
    expect(find(dev, "email-confirmation").status).toBe("warn");
  });

  it("omits the email check entirely when the auth settings were not probed", () => {
    const checks = buildChecks({ db: healthyReport(), env: healthyEnv });
    expect(checks.some((c) => c.id === "email-confirmation")).toBe(false);
  });

  it("gives every non-ok finding something to do about it", () => {
    const checks = buildChecks({
      db: healthyReport({
        rls: { disabled: ["doc_comments"], enabled_without_policies: [] },
        markdown: { body_md_required: false, at_risk_docs: 2, docs: 5 },
        storage: { exists: false },
      }),
      env: {},
      auth: { mailerAutoconfirm: true },
      production: true,
    });
    for (const check of checks.filter((c) => c.status !== "ok")) {
      expect(check.fix, `${check.id} has no fix`).toBeTruthy();
    }
  });
});

describe("overall", () => {
  it("reports the worst status present", () => {
    expect(overall([{ id: "a", title: "A", status: "ok", detail: "" }])).toBe("ok");
    expect(
      overall([
        { id: "a", title: "A", status: "ok", detail: "" },
        { id: "b", title: "B", status: "warn", detail: "" },
      ]),
    ).toBe("warn");
    expect(
      overall([
        { id: "a", title: "A", status: "warn", detail: "" },
        { id: "b", title: "B", status: "fail", detail: "" },
      ]),
    ).toBe("fail");
  });
});
