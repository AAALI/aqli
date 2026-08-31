import { describe, it, expect, vi } from "vitest";
import { schemaDrift, migrationFor, loadOrDrift } from "../drift";

/**
 * The bug these guard: `/w/<slug>` returned "This page couldn't load" with a
 * digest and nothing else, because `blocked_space_ids` did not exist in the
 * database. The error said so plainly; Next stripped it before anyone saw it.
 */
describe("schemaDrift", () => {
  it("recognises a PostgREST function that is not in the schema cache", () => {
    const drift = schemaDrift({
      code: "PGRST202",
      message: "Could not find the function public.blocked_space_ids(p_user_id, p_workspace_id)",
      details: null,
      hint: null,
    });
    expect(drift).not.toBeNull();
    expect(drift?.object).toContain("public.blocked_space_ids");
    // The whole point: name the file that adds it.
    expect(drift?.migration).toBe("20260813000000_space_permissions.sql");
  });

  it("recognises an undefined column", () => {
    const drift = schemaDrift({
      code: "42703",
      message: 'column docs.parent_doc_id does not exist',
    });
    expect(drift?.object).toBe("docs.parent_doc_id");
    expect(drift?.migration).toBe("20260811000000_doc_tree.sql");
  });

  it("recognises an undefined table", () => {
    const drift = schemaDrift({
      code: "42P01",
      message: 'relation "workspace_webhooks" does not exist',
    });
    expect(drift?.object).toBe("workspace_webhooks");
    expect(drift?.migration).toBe("20260814000000_workspace_webhooks.sql");
  });

  it("is not fooled by a permission error", () => {
    // 42501 is a policy refusing a row, which is the code working as intended.
    // Telling an operator to run migrations for this sends them nowhere.
    expect(schemaDrift({ code: "42501", message: "permission denied for table docs" })).toBeNull();
  });

  it("is not fooled by a constraint violation", () => {
    expect(
      schemaDrift({ code: "23514", message: "a sub-page must live in the same space as its parent" }),
    ).toBeNull();
  });

  it("ignores things that are not errors at all", () => {
    expect(schemaDrift(null)).toBeNull();
    expect(schemaDrift("boom")).toBeNull();
    expect(schemaDrift(undefined)).toBeNull();
  });

  it("still reports drift when the object cannot be named", () => {
    // Better a screen that says "the database is behind" than a digest.
    const drift = schemaDrift({ code: "42P01", message: "something does not exist" });
    expect(drift).not.toBeNull();
    expect(drift?.object).toBeNull();
    expect(drift?.detail).toContain("does not exist");
  });
});

describe("migrationFor", () => {
  it("returns null rather than guessing at an unknown object", () => {
    expect(migrationFor("some.thing_we_never_shipped")).toBeNull();
    expect(migrationFor(null)).toBeNull();
  });

  it("prefers the most specific migration name", () => {
    // `space_members` is created by space_permissions, not by anything shorter.
    expect(migrationFor("space_members")).toBe("20260813000000_space_permissions.sql");
  });
});

describe("loadOrDrift", () => {
  it("passes a successful load straight through", async () => {
    const result = await loadOrDrift(async () => [1, 2, 3]);
    expect(result).toEqual({ ok: true, data: [1, 2, 3] });
  });

  it("reports drift instead of throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await loadOrDrift(async () => {
      throw { code: "42P01", message: 'relation "space_members" does not exist' };
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.drift.migration).toBe("20260813000000_space_permissions.sql");
    spy.mockRestore();
  });

  it("rethrows a real bug, so it still reaches the error boundary and the logs", async () => {
    const boom = new Error("cannot read properties of undefined");
    await expect(loadOrDrift(async () => Promise.reject(boom))).rejects.toBe(boom);
  });
});
