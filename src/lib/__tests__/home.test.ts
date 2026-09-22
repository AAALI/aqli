import { describe, expect, it } from "vitest";
import { dayGreeting, homeSummary, shortDay, startOfWeek, whereLeftOff } from "@/lib/home";

describe("dayGreeting", () => {
  it("names the day and the part of it", () => {
    expect(dayGreeting(new Date(2026, 8, 23, 9))).toBe("Wednesday morning.");
    expect(dayGreeting(new Date(2026, 8, 23, 15))).toBe("Wednesday afternoon.");
  });
});

describe("homeSummary", () => {
  it("reads as a sentence and skips what is zero", () => {
    expect(homeSummary(1, 2)).toBe("One draft in flight, two things waiting on you.");
    expect(homeSummary(0, 1)).toBe("One thing waiting on you.");
    expect(homeSummary(3, 0)).toBe("Three drafts in flight.");
    expect(homeSummary(0, 0)).toBe("Nothing is waiting on you.");
  });
});

describe("startOfWeek", () => {
  it("is the Monday of this week, even on a Sunday", () => {
    expect(startOfWeek(new Date(2026, 8, 23)).getDate()).toBe(21);
    expect(startOfWeek(new Date(2026, 8, 27)).getDate()).toBe(21);
    expect(startOfWeek(new Date(2026, 8, 21)).getDate()).toBe(21);
  });
});

describe("shortDay", () => {
  const now = new Date(2026, 8, 23, 12);
  it("says yesterday, then weekday names, then a date", () => {
    expect(shortDay(new Date(2026, 8, 22, 9).toISOString(), now)).toBe("yesterday");
    expect(shortDay(new Date(2026, 8, 21, 9).toISOString(), now)).toBe("Mon");
  });
});

describe("whereLeftOff", () => {
  it("finds the last section and whether the sentence was finished", () => {
    expect(whereLeftOff("## What we're doing\n\nShipping.\n\n## How we'll say it\n\nGetting paid should")).toEqual({
      section: "How we'll say it",
      midSentence: true,
    });
    expect(whereLeftOff("## Plan\n\nDone.").midSentence).toBe(false);
  });
});
