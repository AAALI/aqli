import { describe, expect, it, vi } from "vitest";

vi.mock("../server", () => ({ createServerSupabaseClient: vi.fn() }));

import { answerAdmitsGap, groupGaps, normalizeQuestion } from "../questions";

describe("normalizeQuestion", () => {
  it("treats the same question typed differently as the same question", () => {
    expect(normalizeQuestion("How do I refund a partial payout?")).toBe(
      normalizeQuestion("how do i refund  a PARTIAL payout"),
    );
  });
});

describe("answerAdmitsGap", () => {
  it("counts the model saying the context does not answer it", () => {
    expect(answerAdmitsGap("The provided context does not contain that.")).toBe(true);
    expect(answerAdmitsGap("Refunds under AED 500 need no manager.")).toBe(false);
  });
});

describe("groupGaps", () => {
  const row = (question: string, asked_by: string, answered_by: string | null, created_at: string) => ({
    question,
    normalized: normalizeQuestion(question),
    asked_by,
    answered_by,
    created_at,
  });

  it("counts asks and distinct askers, most-asked first", () => {
    const gaps = groupGaps([
      row("Who approves a price change?", "a", null, "2026-09-02"),
      row("How do I refund a partial payout?", "a", null, "2026-09-01"),
      row("how do i refund a partial payout", "b", null, "2026-09-03"),
      row("How do I refund a partial payout?", "b", null, "2026-09-04"),
    ]);
    expect(gaps.map((g) => [g.count, g.askers])).toEqual([
      [3, 2],
      [1, 1],
    ]);
    expect(gaps[0].question).toBe("How do I refund a partial payout?");
  });

  it("drops a question that was answered at any point", () => {
    const gaps = groupGaps([
      row("Where is the VAT number?", "a", null, "2026-09-01"),
      row("where is the vat number", "b", "doc-1", "2026-09-05"),
    ]);
    expect(gaps).toEqual([]);
  });
});
