import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ScopedClient } from "../scoped";

/**
 * The point of `ScopedClient` is that a query cannot leave its workspace even
 * when the caller forgets to say so. These assert exactly that, against a stub
 * that records what PostgREST would have been asked for.
 */

type Call = { method: string; args: unknown[] };

function stubClient() {
  const calls: Call[] = [];
  const filters: [string, unknown][] = [];

  const chain = {
    eq(column: string, value: unknown) {
      filters.push([column, value]);
      return chain;
    },
    order() {
      return chain;
    },
    limit() {
      return chain;
    },
    // Not a filter method — proves non-filter methods still reach the builder.
    maybeSingle() {
      calls.push({ method: "maybeSingle", args: [] });
      return chain;
    },
  };

  const builder = {
    select(...args: unknown[]) {
      calls.push({ method: "select", args });
      return chain;
    },
    insert(...args: unknown[]) {
      calls.push({ method: "insert", args });
      return chain;
    },
    upsert(...args: unknown[]) {
      calls.push({ method: "upsert", args });
      return chain;
    },
    update(...args: unknown[]) {
      calls.push({ method: "update", args });
      return chain;
    },
    delete(...args: unknown[]) {
      calls.push({ method: "delete", args });
      return chain;
    },
  };

  const raw = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
    rpc(name: string, params: unknown) {
      calls.push({ method: "rpc", args: [name, params] });
      return chain;
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, body: unknown, options: unknown) {
            calls.push({ method: "upload", args: [bucket, path, body, options] });
            return { error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;

  return { raw, calls, filters };
}

const WS = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("ScopedClient", () => {
  it("appends the workspace predicate to a select the caller never filtered", () => {
    const { raw, filters } = stubClient();
    new ScopedClient(raw, WS).from("docs").select("*");
    expect(filters).toEqual([["workspace_id", WS]]);
  });

  it("appends it to update and delete too — the writes that can do damage", () => {
    const { raw, filters } = stubClient();
    const db = new ScopedClient(raw, WS);
    db.from("docs").update({ title: "x" });
    db.from("docs").delete();
    expect(filters).toEqual([
      ["workspace_id", WS],
      ["workspace_id", WS],
    ]);
  });

  it("keeps the caller's own filters and adds its own", () => {
    const { raw, filters } = stubClient();
    new ScopedClient(raw, WS).from("docs").select("*").eq("status", "approved");
    expect(filters).toEqual([
      ["workspace_id", WS],
      ["status", "approved"],
    ]);
  });

  it("stamps workspace_id onto inserts, including bulk ones", () => {
    const { raw, calls } = stubClient();
    const db = new ScopedClient(raw, WS);
    db.from("docs").insert({ title: "one" });
    db.from("docs").insert([{ title: "two" }, { title: "three" }]);

    const inserts = calls.filter((c) => c.method === "insert");
    expect(inserts[0].args[0]).toEqual({ title: "one", workspace_id: WS });
    expect(inserts[1].args[0]).toEqual([
      { title: "two", workspace_id: WS },
      { title: "three", workspace_id: WS },
    ]);
  });

  // The failure this whole class exists to prevent: a caller passing a
  // workspace_id from a request body and reaching into another tenant.
  it("overrides a workspace_id the caller supplied", () => {
    const { raw, calls } = stubClient();
    new ScopedClient(raw, WS).from("docs").insert({ title: "x", workspace_id: OTHER });
    const insert = calls.find((c) => c.method === "insert")!;
    expect(insert.args[0]).toEqual({ title: "x", workspace_id: WS });
  });

  it("stamps upserts as well as inserts, and preserves the options argument", () => {
    const { raw, calls } = stubClient();
    new ScopedClient(raw, WS)
      .from("integration_connections")
      .upsert({ provider: "github" }, { onConflict: "workspace_id,provider" });
    const upsert = calls.find((c) => c.method === "upsert")!;
    expect(upsert.args[0]).toEqual({ provider: "github", workspace_id: WS });
    expect(upsert.args[1]).toEqual({ onConflict: "workspace_id,provider" });
  });

  it("scopes `workspaces` by its own id, since it has no workspace_id column", () => {
    const { raw, filters } = stubClient();
    new ScopedClient(raw, WS).from("workspaces").select("slug");
    expect(filters).toEqual([["id", WS]]);
  });

  // `doc_versions` is the one table with no workspace column. It is reached
  // only through a doc_id resolved from an already-scoped query, so it is
  // opted out explicitly rather than silently.
  it("leaves an explicitly unscopable table alone", () => {
    const { raw, filters } = stubClient();
    new ScopedClient(raw, WS).from("doc_versions").select("*");
    expect(filters).toEqual([]);
  });

  // A new table added to the schema must not default to unscoped access.
  it("throws for a table with no scoping rule rather than querying it unscoped", () => {
    const { raw } = stubClient();
    expect(() => new ScopedClient(raw, WS).from("secrets")).toThrowError(
      /no scoping rule for table "secrets"/,
    );
  });

  it("passes non-filter builder methods straight through", () => {
    const { raw, calls, filters } = stubClient();
    new ScopedClient(raw, WS).from("spaces").select("id").eq("slug", "eng").maybeSingle();
    expect(calls.some((c) => c.method === "maybeSingle")).toBe(true);
    expect(filters).toEqual([
      ["workspace_id", WS],
      ["slug", "eng"],
    ]);
  });

  it("passes rpc through untouched — the app functions scope themselves", () => {
    const { raw, calls } = stubClient();
    new ScopedClient(raw, WS).rpc("submit_proposal", { p_workspace_id: WS });
    expect(calls.find((c) => c.method === "rpc")).toEqual({
      method: "rpc",
      args: ["submit_proposal", { p_workspace_id: WS }],
    });
  });
});

describe("ScopedClient.upload", () => {
  const bytes = new Uint8Array([1, 2, 3]);

  it("uploads an object inside the workspace's own prefix", async () => {
    const { raw, calls } = stubClient();
    await new ScopedClient(raw, WS).upload(
      "doc-images",
      `${WS}/doc-1/desk.png`,
      bytes,
      { contentType: "image/png", upsert: true },
    );
    expect(calls).toContainEqual({
      method: "upload",
      args: ["doc-images", `${WS}/doc-1/desk.png`, bytes, { contentType: "image/png", upsert: true }],
    });
  });

  it("refuses a path belonging to another workspace", async () => {
    // Storage has no workspace_id to filter on: for doc images the first path
    // segment is the tenancy boundary, so the same rule applies to it.
    const { raw, calls } = stubClient();
    await expect(
      new ScopedClient(raw, WS).upload("doc-images", `${OTHER}/doc-1/desk.png`, bytes, {
        contentType: "image/png",
      }),
    ).rejects.toThrow(/outside workspace/);
    expect(calls.some((c) => c.method === "upload")).toBe(false);
  });

  it("refuses a path with no workspace segment at all", async () => {
    const { raw } = stubClient();
    await expect(
      new ScopedClient(raw, WS).upload("doc-images", "desk.png", bytes, { contentType: "image/png" }),
    ).rejects.toThrow(/outside workspace/);
  });
});
