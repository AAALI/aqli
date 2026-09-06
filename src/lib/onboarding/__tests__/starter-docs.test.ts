import { describe, it, expect } from "vitest";
import { starterDocs } from "../starter-docs";
import { normalize } from "@/lib/markdown";

describe("starterDocs", () => {
  const docs = starterDocs("Acme");

  it("seeds the two documents every adopting company writes anyway", () => {
    expect(docs).toHaveLength(2);
    expect(docs[0].title).toBe("How we run Acme docs");
    expect(docs[1].title).toBe("Running this instance");
  });

  it("survives the markdown round trip, like anything else stored here", () => {
    // Seeded content goes through the same pipeline as typed content. A
    // template that does not round-trip would rewrite itself on first save.
    for (const doc of docs) {
      const once = normalize(doc.bodyMd);
      expect(normalize(once)).toBe(once);
    }
  });

  it("does not repeat the title as a heading, which the reader already sees", () => {
    for (const doc of docs) {
      expect(doc.bodyMd.trimStart().startsWith("# ")).toBe(false);
    }
  });

  it("tells an operator the two commands that matter", () => {
    const runbook = docs[1].bodyMd;
    expect(runbook).toContain("pnpm preflight");
    expect(runbook).toContain("pnpm export");
  });

  it("leaves the per-installation answers blank rather than inventing them", () => {
    // A runbook that guesses at your region and your backup policy is worse
    // than one that asks: it reads as true.
    expect(docs[1].bodyMd).toContain("_");
    expect(docs[1].bodyMd).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/);
  });
});
