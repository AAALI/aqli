import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ImportReport } from "@/lib/import/types";

const mocks = vi.hoisted(() => ({
  getRole: vi.fn(), single: vi.fn(), runImport: vi.fn(),
  importDeps: vi.fn(), proposeDoc: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-id" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }),
  }),
}));
vi.mock("@/lib/supabase/members", () => ({ getMyRole: mocks.getRole }));
vi.mock("@/lib/import/sources/markdown-zip", () => ({ markdownZipSource: () => ({}) }));
vi.mock("@/lib/import/db", () => ({ importDeps: mocks.importDeps }));
vi.mock("@/lib/import/pipeline", () => ({ runImport: mocks.runImport }));
vi.mock("@/lib/supabase/agent-docs", () => ({ proposeAgentDoc: mocks.proposeDoc }));
vi.mock("@/lib/audit", () => ({ recordAudit: mocks.audit, humanActor: () => ({ type: "human" }) }));
const { POST } = await import("../route");

function request() {
  const body = new FormData();
  body.set("workspace_id", "workspace-id");
  body.set("file", new File(["placeholder"], "pages.zip", { type: "application/zip" }));
  return new NextRequest("https://aqli.example/api/imports", { method: "POST", body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRole.mockResolvedValue("admin");
  mocks.single.mockResolvedValue({ data: { slug: "team" }, error: null });
  const report: ImportReport = {
    source: "zip", startedAt: "2026-10-31", finishedAt: "2026-10-31", dryRun: true,
    pages: [{
      sourceId: "page.md", title: "Imported page", docId: "doc-id", status: "created",
      images: [], unplacedAttachments: [], unresolvedLinks: [], unmappedAuthor: null, notes: [],
    }],
  };
  mocks.runImport.mockResolvedValue(report);
});

describe("browser import links", () => {
  it("uses workspace-qualified links in both imported content and its report", async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    const options = mocks.runImport.mock.calls[0][2] as { docHref: (id: string) => string };
    expect(options.docHref("target-id")).toBe("/w/team/docs/target-id");
    expect((await res.json()).report).toContain("[Imported page](/w/team/docs/doc-id)");
  });

  it("does not start importing when the workspace slug could not be read", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
    const res = await POST(request());
    expect(res.status).toBe(500);
    expect(mocks.runImport).not.toHaveBeenCalled();
  });

  it("checks admin access before loading the workspace or importing", async () => {
    mocks.getRole.mockResolvedValue("viewer");
    const res = await POST(request());
    expect(res.status).toBe(403);
    expect(mocks.single).not.toHaveBeenCalled();
    expect(mocks.runImport).not.toHaveBeenCalled();
  });
});
