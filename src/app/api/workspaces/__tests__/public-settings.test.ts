import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaces: vi.fn(), createWorkspace: vi.fn(), getRole: vi.fn(), single: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => {
    const query = { select: vi.fn(), eq: vi.fn(), update: vi.fn(), single: mocks.single };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.update.mockReturnValue(query);
    return {
      auth: { getUser: async () => ({ data: { user: { id: "user-id" } } }) },
      from: () => query,
    };
  },
}));
vi.mock("@/lib/supabase/workspaces", () => ({
  getMyWorkspaces: mocks.getWorkspaces,
  createWorkspace: mocks.createWorkspace,
}));
vi.mock("@/lib/supabase/members", () => ({ getMyRole: mocks.getRole }));
vi.mock("@/lib/onboarding/seed", () => ({ seedStarterDocs: async () => {} }));
vi.mock("@/lib/audit", () => ({ recordAudit: async () => {}, humanActor: () => ({ type: "human" }) }));
const { GET, POST } = await import("../route");
const { PATCH } = await import("../[id]/route");

const workspace = {
  id: "workspace-id", name: "Team", slug: "team", created_at: "2026-10-31",
  settings: { openai_key: "unused-test-key", onboarded_at: "done" },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getWorkspaces.mockResolvedValue([workspace]);
  mocks.createWorkspace.mockResolvedValue(workspace);
  mocks.getRole.mockResolvedValue("admin");
  mocks.single.mockResolvedValue({ data: workspace, error: null });
});

describe("workspace browser responses", () => {
  it("redacts legacy keys from workspace listings without dropping onboarding state", async () => {
    const body = await (await GET()).json();
    expect(body.workspaces[0].settings).toEqual({ onboarded_at: "done" });
  });

  it("redacts legacy keys from workspace creation responses", async () => {
    const req = new NextRequest("https://aqli.example/api/workspaces", {
      method: "POST", body: JSON.stringify({ name: "Team", slug: "team" }),
    });
    const body = await (await POST(req)).json();
    expect(body.workspace.settings).toEqual({ onboarded_at: "done" });
  });

  it("redacts legacy keys from workspace update responses", async () => {
    const req = new NextRequest("https://aqli.example/api/workspaces/workspace-id", {
      method: "PATCH", body: JSON.stringify({ name: "Team" }),
    });
    const body = await (await PATCH(req, { params: Promise.resolve({ id: workspace.id }) })).json();
    expect(body.workspace.settings).toEqual({ onboarded_at: "done" });
  });
});
