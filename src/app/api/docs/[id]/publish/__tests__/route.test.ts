import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
const getDoc = vi.fn();
const getMyRole = vi.fn();
const listWorkspaceMembers = vi.fn();
const logActivity = vi.fn();
const scoped = vi.fn();
const spaceQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
};
const docQuery = {
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
};
const insert = vi.fn();
const from = vi.fn();
const db = { from: vi.fn() };

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));
vi.mock("@/lib/supabase/docs", () => ({ getDoc }));
vi.mock("@/lib/supabase/members", () => ({ getMyRole, listWorkspaceMembers }));
vi.mock("@/lib/supabase/activity", () => ({ logActivity }));
vi.mock("@/lib/db", () => ({ scoped }));

const { POST } = await import("../route");

const draft = { id: "doc1", workspace_id: "ws1", owner_id: "writer", status: "draft", space_id: "space1", doc_class: "canon" };
const user = { id: "writer", email: "writer@example.test", user_metadata: {} };
const member = (id: string, role: string) => ({
  user_id: id, role, full_name: id, email: `${id}@example.test`,
});

function publish(body: unknown = {}) {
  const req = new NextRequest("https://aqli.test/api/docs/doc1/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: "doc1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user } });
  getDoc.mockResolvedValue({ ...draft });
  getMyRole.mockResolvedValue("editor");
  listWorkspaceMembers.mockResolvedValue([member("writer", "editor"), member("checker", "editor")]);
  from.mockReturnValue(spaceQuery);
  spaceQuery.maybeSingle.mockResolvedValue({ data: { id: "space1", review_policy: "review_agents" }, error: null });
  docQuery.maybeSingle.mockResolvedValue({ data: { id: "doc1" }, error: null });
  scoped.mockReturnValue(db);
  db.from.mockImplementation((table: string) => table === "docs" ? docQuery : { insert });
  insert.mockResolvedValue({ error: null });
  logActivity.mockResolvedValue(undefined);
});

describe("publish authorization and state", () => {
  it("requires a session before reading or writing", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await publish()).status).toBe(401);
    expect(getDoc).not.toHaveBeenCalled();
    expect(scoped).not.toHaveBeenCalled();
  });

  it("does not publish a missing or RLS-hidden draft", async () => {
    getDoc.mockRejectedValue(new Error("Not found"));
    expect((await publish()).status).toBe(404);
    expect(scoped).not.toHaveBeenCalled();
  });

  it.each(["viewer", null])("refuses role %s without service-role access", async (role) => {
    getMyRole.mockResolvedValue(role);
    expect((await publish()).status).toBe(403);
    expect(scoped).not.toHaveBeenCalled();
  });

  it("does not let a shared editor publish another author's draft", async () => {
    getDoc.mockResolvedValue({ ...draft, owner_id: "someone-else" });
    expect((await publish()).status).toBe(403);
    expect(scoped).not.toHaveBeenCalled();
  });

  it.each(["approved", "review", "archived", "stale"])("refuses to republish a %s page", async (status) => {
    getDoc.mockResolvedValue({ ...draft, status });
    expect((await publish()).status).toBe(409);
    expect(scoped).not.toHaveBeenCalled();
  });

  it("lets an admin publish an accessible ownerless draft", async () => {
    getMyRole.mockResolvedValue("admin");
    getDoc.mockResolvedValue({ ...draft, owner_id: null });
    expect((await publish()).status).toBe(200);
  });

  it("requires the document still to be a draft at update time", async () => {
    docQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await publish()).status).toBe(409);
    expect(docQuery.eq).toHaveBeenCalledWith("status", "draft");
    expect(insert).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });
});

describe("publish destination and checkers", () => {
  it.each(["editor", "admin"])("refuses direct canon publishing into review_all for %s", async (role) => {
    getMyRole.mockResolvedValue(role);
    spaceQuery.maybeSingle.mockResolvedValue({ data: { id: "space1", review_policy: "review_all" }, error: null });
    const res = await publish();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("requires review");
    expect(scoped).not.toHaveBeenCalled();
  });

  it.each(["open", "review_agents"])("allows human canon publishing under %s", async (review_policy) => {
    spaceQuery.maybeSingle.mockResolvedValue({ data: { id: "space1", review_policy }, error: null });
    expect((await publish()).status).toBe(200);
  });

  it("allows records in review_all, matching the canonical disposition rule", async () => {
    getDoc.mockResolvedValue({ ...draft, doc_class: "record" });
    spaceQuery.maybeSingle.mockResolvedValue({ data: { id: "space1", review_policy: "review_all" }, error: null });
    expect((await publish()).status).toBe(200);
  });

  it("fails closed if a destination's review policy is not recognized", async () => {
    spaceQuery.maybeSingle.mockResolvedValue({ data: { id: "space1", review_policy: "unknown" }, error: null });
    expect((await publish()).status).toBe(409);
    expect(scoped).not.toHaveBeenCalled();
  });

  it.each([null, [], "invalid", { space_id: 42 }])("rejects an invalid payload %j", async (body) => {
    expect((await publish(body)).status).toBe(400);
    expect(scoped).not.toHaveBeenCalled();
  });

  it("validates the destination using caller visibility and the draft's workspace", async () => {
    expect((await publish({ space_id: "destination" })).status).toBe(200);
    expect(from).toHaveBeenCalledWith("spaces");
    expect(spaceQuery.eq).toHaveBeenCalledWith("workspace_id", "ws1");
    expect(spaceQuery.eq).toHaveBeenCalledWith("id", "destination");
    expect(scoped).toHaveBeenCalledWith("ws1");
    expect(docQuery.update).toHaveBeenCalledWith(expect.objectContaining({ space_id: "destination" }));
  });

  it("rejects a foreign, missing, or inaccessible destination before writing", async () => {
    spaceQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await publish({ space_id: "inaccessible" })).status).toBe(400);
    expect(scoped).not.toHaveBeenCalled();
  });

  it("does not publish as current when the selected checkers cannot be loaded", async () => {
    listWorkspaceMembers.mockRejectedValue(new Error("Offline"));
    expect((await publish({ checker_ids: ["checker"] })).status).toBe(503);
    expect(scoped).not.toHaveBeenCalled();
  });

  it("publishes an author's draft as current when no check is requested", async () => {
    const res = await publish();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ state: "current", checkers: [] });
    expect(docQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "approved", last_reviewed_at: expect.any(String),
    }));
    expect(insert).not.toHaveBeenCalled();
  });

  it("asks each eligible checker once and excludes self, viewers, and outsiders", async () => {
    listWorkspaceMembers.mockResolvedValue([
      member("writer", "editor"), member("checker", "editor"), member("viewer", "viewer"),
    ]);
    const res = await publish({ checker_ids: ["checker", "checker", "writer", "viewer", "outsider", 1] });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ state: "unverified", checkers: ["checker"] });
    expect(docQuery.update).toHaveBeenCalledWith(expect.objectContaining({ status: "review", last_reviewed_at: null }));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ mentions: ["checker"], comment_type: "review_request" }));
  });
});
