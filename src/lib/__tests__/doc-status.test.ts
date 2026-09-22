import { describe, expect, it } from "vitest";
import { docState, editedSinceConfirmed, isPublished, STATE_LABEL } from "@/lib/doc-status";
import type { VerifyCadence } from "@/lib/verify-cadence";

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function doc(opts: {
  confirmedDaysAgo?: number | null;
  writtenDaysAgo?: number;
  cadence?: VerifyCadence;
}) {
  const { confirmedDaysAgo = null, writtenDaysAgo = confirmedDaysAgo ?? 0, cadence } = opts;
  return {
    last_reviewed_at: confirmedDaysAgo === null ? null : ago(confirmedDaysAgo * DAY),
    updated_at: ago(writtenDaysAgo * DAY),
    frontmatter: cadence ? { verify_cadence: cadence } : null,
  };
}

describe("docState — the three answers", () => {
  it("is Current when someone confirmed it and it has not outrun its cadence", () => {
    expect(docState(doc({ confirmedDaysAgo: 5, cadence: "quarterly" }))).toBe("current");
  });

  it("is Ageing once a confirmed doc outruns its cadence", () => {
    expect(docState(doc({ confirmedDaysAgo: 120, cadence: "quarterly" }))).toBe("ageing");
    expect(docState(doc({ confirmedDaysAgo: 40, cadence: "monthly" }))).toBe("ageing");
  });

  it("is Unverified when nobody has ever confirmed it", () => {
    expect(docState(doc({ confirmedDaysAgo: null }))).toBe("unverified");
  });

  it("is Unverified when a confirmed doc has been edited since", () => {
    // Confirmed a month ago, written to yesterday.
    expect(docState(doc({ confirmedDaysAgo: 30, writtenDaysAgo: 1 }))).toBe("unverified");
  });
});

describe("docState — verification is opt-in", () => {
  it("never ages a doc nobody has confirmed, however old it is", () => {
    // Two years untouched and never confirmed: still Unverified, not Ageing.
    // Your own docs do not nag you.
    expect(docState(doc({ confirmedDaysAgo: null, writtenDaysAgo: 730 }))).toBe("unverified");
  });

  it("stays Current forever when the doc is held to no cadence", () => {
    expect(docState(doc({ confirmedDaysAgo: 900, cadence: "none" }))).toBe("current");
  });
});

describe("editedSinceConfirmed", () => {
  it("ignores the timestamp gap a confirmation writes into updated_at", () => {
    // Confirming sets `last_reviewed_at` from the app clock and the trigger
    // bumps `updated_at` from the database clock a moment later. That must not
    // read as an edit, or every confirmation would invalidate itself.
    const confirmed = Date.now() - 5 * DAY;
    expect(
      editedSinceConfirmed({
        last_reviewed_at: new Date(confirmed).toISOString(),
        updated_at: new Date(confirmed + 1_500).toISOString(),
        frontmatter: null,
      }),
    ).toBe(false);
  });

  it("counts a write well after the confirmation", () => {
    const confirmed = Date.now() - 5 * DAY;
    expect(
      editedSinceConfirmed({
        last_reviewed_at: new Date(confirmed).toISOString(),
        updated_at: new Date(confirmed + 10 * MINUTE).toISOString(),
        frontmatter: null,
      }),
    ).toBe(true);
  });

  it("is false for a doc nobody confirmed — there is nothing to invalidate", () => {
    expect(
      editedSinceConfirmed({ last_reviewed_at: null, updated_at: ago(DAY), frontmatter: null }),
    ).toBe(false);
  });
});

describe("labels", () => {
  it("never says Draft, Approved or Stale", () => {
    const words = Object.values(STATE_LABEL);
    expect(words).toEqual(["Current", "Ageing", "Unverified"]);
    for (const w of words) {
      expect(["Draft", "Approved", "Stale", "Review"]).not.toContain(w);
    }
  });
});

describe("isPublished", () => {
  it("treats draft as a place, not a state", () => {
    expect(isPublished("draft")).toBe(false);
    expect(isPublished("review")).toBe(true);
    expect(isPublished("approved")).toBe(true);
    expect(isPublished("stale")).toBe(true);
  });
});
