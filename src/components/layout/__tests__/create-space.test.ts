import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpaceRequest } from "../NewSpaceButton";

afterEach(() => vi.unstubAllGlobals());

describe("space creation feedback", () => {
  it("trims the name and reports success only for a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ space: { id: "space" } }, { status: 201 })));
    expect(await createSpaceRequest("workspace", "  Marketing  ", "folder")).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/spaces", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ workspace_id: "workspace", name: "Marketing", icon: "folder" }),
    }));
  });

  it.each([400, 409])("shows actionable validation feedback for HTTP %s", async (status) => {
    const message = status === 409 ? 'A space at "marketing" already exists.' : "name must contain a letter or number";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: message }, { status })));
    expect(await createSpaceRequest("workspace", "Marketing", "folder")).toBe(message);
  });

  it("provides a fallback for a non-JSON server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 500 })));
    expect(await createSpaceRequest("workspace", "Marketing", "folder")).toBe("Couldn't create the space. Try again.");
  });

  it("does not leak unexpected server error text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Internal database error" }, { status: 500 })));
    expect(await createSpaceRequest("workspace", "Marketing", "folder")).toBe("Couldn't create the space. Try again.");
  });

  it("turns a network rejection into retry feedback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await createSpaceRequest("workspace", "Marketing", "folder")).toBe("Couldn't reach the server. Try again.");
  });
});
