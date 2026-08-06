import { describe, expect, it } from "vitest";
import {
  NUMBERED_STEPS,
  SUGGESTED_SPACES,
  canAddCustomSpace,
  nextStep,
  prevStep,
  resolveEntry,
  slugAlternatives,
  spacesToCreate,
  stepEyebrow,
  suggestSlug,
  toggleSpace,
  validateSlug,
} from "../plan";

describe("steps", () => {
  it("walks forwards and backwards without falling off either end", () => {
    expect(nextStep("account")).toBe("workspace");
    expect(nextStep("assistant")).toBe("done");
    expect(nextStep("done")).toBe("done");
    expect(prevStep("workspace")).toBe("account");
    expect(prevStep("account")).toBe("account");
  });

  it("numbers every step except the terminal one", () => {
    expect(stepEyebrow("account")).toBe("Step 1 of 4");
    expect(stepEyebrow("assistant")).toBe("Step 4 of 4");
    expect(stepEyebrow("done")).toBeNull();
    expect(NUMBERED_STEPS).toHaveLength(4);
  });
});

describe("slugs", () => {
  it("suggests a slug from a workspace name", () => {
    expect(suggestSlug("ACME Corp")).toBe("acme-corp");
    expect(suggestSlug("  Böse & Söhne  ")).toBe("bse-shne");
  });

  it("rejects empty, short, reserved and malformed slugs", () => {
    expect(validateSlug("")).toMatchObject({ ok: false });
    expect(validateSlug("a")).toMatchObject({ ok: false });
    expect(validateSlug("api")).toMatchObject({ ok: false });
    expect(validateSlug("settings")).toMatchObject({ ok: false });
    expect(validateSlug("Acme")).toMatchObject({ ok: false });
    expect(validateSlug("acme corp")).toMatchObject({ ok: false });
    expect(validateSlug("x".repeat(49))).toMatchObject({ ok: false });
  });

  it("accepts ordinary slugs", () => {
    expect(validateSlug("acme")).toEqual({ ok: true });
    expect(validateSlug("acme-corp-2")).toEqual({ ok: true });
  });

  it("offers alternatives that skip the taken ones", () => {
    expect(slugAlternatives("acme", [])).toEqual(["acme-hq", "acme-team", "acme-2"]);
    expect(slugAlternatives("acme", ["acme-hq"], seeded())).toEqual([
      "acme-team",
      "acme-2",
      "acme-xxxx",
    ]);
  });

  it("never proposes a slug that would fail validation", () => {
    for (const candidate of slugAlternatives("api", [])) {
      expect(validateSlug(candidate)).toEqual({ ok: true });
    }
  });

  it("falls back to a generic root when the name slugs to nothing", () => {
    expect(slugAlternatives("!!!", [])).toEqual([
      "workspace-hq",
      "workspace-team",
      "workspace-2",
    ]);
  });
});

// slugAlternatives takes its randomness as a parameter so the exhausted-suffix
// path is deterministic here.
function seeded() {
  let n = 0;
  return () => ["xxxx", "yyyy", "zzzz"][n++ % 3];
}

describe("slug alternatives with a stubbed seed", () => {
  it("reaches for the seed only once the suffixes run out", () => {
    expect(slugAlternatives("acme", ["acme-hq", "acme-team", "acme-2"], seeded())).toEqual([
      "acme-xxxx",
      "acme-yyyy",
      "acme-zzzz",
    ]);
  });
});

describe("spaces", () => {
  it("toggles a space on and off", () => {
    expect(toggleSpace([], "Sales", [])).toEqual(["Sales"]);
    expect(toggleSpace(["Sales"], "Sales", [])).toEqual([]);
  });

  it("refuses to untick a space that already exists", () => {
    expect(toggleSpace(["Company"], "Company", ["Company"])).toEqual(["Company"]);
    expect(toggleSpace(["Company"], "company", ["Company"])).toEqual(["Company"]);
  });

  it("only adds custom names that are new and sluggable", () => {
    expect(canAddCustomSpace("Legal", ["Sales"])).toBe(true);
    expect(canAddCustomSpace("  ", ["Sales"])).toBe(false);
    expect(canAddCustomSpace("!!!", [])).toBe(false);
    expect(canAddCustomSpace("sales", ["Sales"])).toBe(false);
  });

  it("creates only what is missing, with the right icon", () => {
    const out = spacesToCreate(["Company", "Sales", "Legal"], ["Company"], ["Legal"]);
    expect(out).toEqual([
      { name: "Sales", slug: "sales", icon: "💼" },
      { name: "Legal", slug: "legal", icon: "📁" },
    ]);
  });

  it("does not emit two spaces that would collide on slug", () => {
    // spaces are unique on (workspace_id, slug), so "Sales" and "sales" cannot
    // both be created — the second would 409.
    const out = spacesToCreate(["Sales", "sales"], [], []);
    expect(out).toHaveLength(1);
  });

  it("seeds Company first so the pre-created space heads the list", () => {
    expect(SUGGESTED_SPACES[0].name).toBe("Company");
  });
});

describe("resolveEntry", () => {
  const ws = { id: "w1", slug: "acme", name: "ACME" };

  it("starts a signed-out visitor at the account step", () => {
    expect(resolveEntry({ hasUser: false, workspaces: [] })).toEqual({
      kind: "step",
      step: "account",
    });
  });

  it("sends a signed-in user with no workspace to the workspace step", () => {
    expect(resolveEntry({ hasUser: true, workspaces: [] })).toEqual({
      kind: "step",
      step: "workspace",
    });
  });

  it("resumes at spaces when the workspace still holds only its seeded space", () => {
    expect(resolveEntry({ hasUser: true, workspaces: [ws], spaceCount: 1 })).toEqual({
      kind: "resume",
      step: "spaces",
      workspace: ws,
    });
  });

  it("redirects an established workspace into the app", () => {
    expect(resolveEntry({ hasUser: true, workspaces: [ws], spaceCount: 4 })).toEqual({
      kind: "redirect",
      to: "/w/acme",
    });
  });

  it("never asks an existing member to create a second workspace", () => {
    for (const spaceCount of [0, 1, 2, 9]) {
      const entry = resolveEntry({ hasUser: true, workspaces: [ws], spaceCount });
      expect(entry.kind).not.toBe("step");
    }
  });
});
