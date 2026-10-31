import { Children, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  cursor: 0,
  setters: Array.from({ length: 5 }, () => vi.fn()),
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => [initial, state.setters[state.cursor++]],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import CurateShelves from "../CurateShelves";

describe("shelf editor reopening", () => {
  beforeEach(() => {
    state.cursor = 0;
    state.setters.forEach((set) => set.mockClear());
  });

  it("restores persisted shelves and clears old errors whenever Edit opens", () => {
    const startHere = ["saved-start"];
    const readingPath = ["saved-second", "saved-first"];
    const tree = CurateShelves({ spaceId: "space", docs: [], startHere, readingPath });
    const trigger = Children.toArray(tree.props.children)[0] as ReactElement<{ onClick: () => void }>;
    trigger.props.onClick();
    expect(state.setters[1]).toHaveBeenCalledWith(startHere);
    expect(state.setters[2]).toHaveBeenCalledWith(readingPath);
    expect(state.setters[4]).toHaveBeenCalledWith(null);
    expect(state.setters[0]).toHaveBeenCalledWith(true);
  });

  it("uses newly persisted selections after a props refresh instead of older local choices", () => {
    CurateShelves({ spaceId: "space", docs: [], startHere: ["old"], readingPath: ["old"] });
    state.cursor = 0;
    const tree = CurateShelves({ spaceId: "space", docs: [], startHere: ["new"], readingPath: ["new", "other"] });
    const trigger = Children.toArray(tree.props.children)[0] as ReactElement<{ onClick: () => void }>;
    trigger.props.onClick();
    expect(state.setters[1]).toHaveBeenCalledWith(["new"]);
    expect(state.setters[2]).toHaveBeenCalledWith(["new", "other"]);
  });
});
