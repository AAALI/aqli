import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/workspaces", () => ({ getWorkspaceBySlug: vi.fn().mockResolvedValue({ id: "workspace", slug: "team" }) }));
vi.mock("@/lib/supabase/spaces", () => ({ getSpaces: vi.fn().mockResolvedValue([{ id: "space", slug: "engineering", name: "Engineering" }]) }));
vi.mock("@/lib/supabase/docs", () => ({ searchDocs: vi.fn() }));
vi.mock("@/lib/supabase/owners", () => ({ getOwnerDirectory: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/supabase/questions", () => ({ getGaps: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn().mockResolvedValue({ id: "user" }) }));
vi.mock("@/components/layout/AppTopBar", () => ({ default: () => null }));
vi.mock("../SearchBox", () => ({ default: () => null }));
vi.mock("../SearchAnswer", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => createElement("a", props, children),
}));

import { searchDocs } from "@/lib/supabase/docs";
import SearchPage from "../page";

const render = async (query = "retry") => renderToStaticMarkup(await SearchPage({
  params: Promise.resolve({ workspace: "team" }),
  searchParams: Promise.resolve({ q: query, space: "engineering", current: "1" }),
}));

describe("search result availability", () => {
  beforeEach(() => { vi.mocked(searchDocs).mockReset(); });

  it("shows an outage and a filter-preserving retry rather than zero matches", async () => {
    vi.mocked(searchDocs).mockRejectedValue(new Error("database unavailable"));
    const html = await render();
    expect(html).toContain('role="alert"');
    expect(html).toContain("Couldn&#x27;t search your docs.");
    expect(html).toContain('href="/w/team/search?q=retry&amp;space=engineering&amp;current=1"');
    expect(html).toContain("Try again");
    expect(html).not.toContain("No doc mentions that.");
    expect(html).not.toContain("Matches · 0");
    expect(html).not.toContain("database unavailable");
  });

  it("retains the empty-result state after a successful search", async () => {
    vi.mocked(searchDocs).mockResolvedValue([]);
    const html = await render();
    expect(html).toContain("No doc mentions that.");
    expect(html).toContain("Matches · 0");
    expect(html).not.toContain('role="alert"');
  });

  it("does not search or show an outage for an empty question", async () => {
    const html = await render("   ");
    expect(searchDocs).not.toHaveBeenCalled();
    expect(html).toContain("Ask the way you would ask a colleague.");
    expect(html).not.toContain('role="alert"');
  });
});
