import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db", () => ({ scoped: vi.fn() }));

import { AUDIT_GROUPS, auditRow, auditVerb, csvCell } from "@/lib/audit";

const USER = "11111111-1111-4111-8111-111111111111";
const KEY = "22222222-2222-4222-8222-222222222222";
const DOC = "33333333-3333-4333-8333-333333333333";

describe("auditRow", () => {
  it("records a human by user id", () => {
    const row = auditRow({
      workspaceId: "ws",
      actor: { type: "human", userId: USER, name: "Sara" },
      action: "doc.archived",
      target: { type: "doc", id: DOC, label: "Leave policy" },
      docId: DOC,
    });
    expect(row).toMatchObject({
      actor_type: "human",
      actor_id: USER,
      actor_key_id: null,
      actor_name: "Sara",
      action: "doc.archived",
      target_label: "Leave policy",
      doc_id: DOC,
    });
  });

  it("records an agent by key, accountable to the key's owner", () => {
    const row = auditRow({
      workspaceId: "ws",
      actor: { type: "agent", keyId: KEY, ownerUserId: USER, name: "Release bot" },
      action: "doc.edited",
      target: { type: "doc", id: DOC },
    });
    expect(row).toMatchObject({ actor_type: "agent", actor_id: USER, actor_key_id: KEY });
  });

  it("drops ids that are not uuids rather than failing the insert", () => {
    // Agent activity has historically carried a free-text agent_id.
    const row = auditRow({
      workspaceId: "ws",
      actor: { type: "agent", keyId: "composio-github", name: "Composio GitHub" },
      action: "doc.created",
      target: { type: "doc", id: "not-a-uuid" },
      docId: "not-a-uuid",
    });
    expect(row.actor_key_id).toBeNull();
    expect(row.doc_id).toBeNull();
    expect(row.target_id).toBe("not-a-uuid");
  });
});

describe("auditVerb", () => {
  it("reads as a sentence", () => {
    expect(auditVerb("doc.deleted")).toBe("permanently deleted");
    expect(auditVerb("draft.discarded")).toBe("discarded the draft");
  });
  it("falls back to the verb for an action it does not know", () => {
    expect(auditVerb("doc.something_new")).toBe("something new");
  });
});

describe("AUDIT_GROUPS", () => {
  it("puts every destructive action under Deletions & archive", () => {
    const g = AUDIT_GROUPS.find((x) => x.key === "deletions")!;
    for (const a of ["doc.deleted", "doc.archived", "doc.restored", "draft.discarded"]) {
      expect(g.prefixes).toContain(a);
    }
  });
});

describe("csvCell", () => {
  it("quotes and escapes", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell(null)).toBe("");
  });
  it("defuses spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("-1")).toBe(`"'-1"`);
  });
});
