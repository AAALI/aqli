import { describe, expect, test, vi } from "vitest";
import { pumpSaveQueue, type SavePumpState } from "../save-pump";

type Updates = Record<string, unknown>;

function state(pending: Updates | null): SavePumpState<Updates> {
  return { pending, inFlight: null };
}

describe("pumpSaveQueue", () => {
  test("concurrent callers wait for the active drain and its queued updates", async () => {
    const queue = state({ title: "First" });
    let finishFirst!: (ok: boolean) => void;
    const firstSave = new Promise<boolean>((resolve) => {
      finishFirst = resolve;
    });
    const persisted: Updates[] = [];
    const persist = vi.fn(async (updates: Updates) => {
      persisted.push(updates);
      return persisted.length === 1 ? firstSave : true;
    });

    const first = pumpSaveQueue(queue, persist);
    queue.pending = { body_md: "Latest body" };
    const concurrent = pumpSaveQueue(queue, persist);

    expect(concurrent).toBe(first);
    finishFirst(true);

    await expect(concurrent).resolves.toBe(true);
    expect(persisted).toEqual([
      { title: "First" },
      { body_md: "Latest body" },
    ]);
    expect(queue.pending).toBeNull();
  });

  test("reports failures and preserves updates for retry", async () => {
    const queue = state({ title: "Draft", body_md: "Old body" });
    const persist = vi
      .fn<(updates: Updates) => Promise<boolean>>()
      .mockImplementationOnce(async () => {
        queue.pending = { body_md: "New body" };
        return false;
      })
      .mockResolvedValueOnce(true);

    await expect(pumpSaveQueue(queue, persist)).resolves.toBe(false);
    expect(queue.pending).toEqual({ title: "Draft", body_md: "New body" });

    await expect(pumpSaveQueue(queue, persist)).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenLastCalledWith({ title: "Draft", body_md: "New body" });
    expect(queue.pending).toBeNull();
  });

  test("merges title and body queued before a flush into one save, latest values winning", async () => {
    const queue = state(null);
    queue.pending = { title: "A", body_md: "Old body" };
    queue.pending = { ...queue.pending, title: "B" };
    queue.pending = { ...queue.pending, body_md: "New body" };
    const persist = vi.fn(async () => true);

    await expect(pumpSaveQueue(queue, persist)).resolves.toBe(true);
    expect(persist).toHaveBeenCalledExactlyOnceWith({ title: "B", body_md: "New body" });
    expect(queue.pending).toBeNull();
  });

  test("sends nothing when the queue is empty", async () => {
    const persist = vi.fn(async () => true);

    await expect(pumpSaveQueue(state(null), persist)).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  test("preserves the snapshot for retry when persist throws", async () => {
    const queue = state({ title: "Do not lose me" });
    const persist = vi
      .fn<(updates: Updates) => Promise<boolean>>()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(true);

    await expect(pumpSaveQueue(queue, persist)).resolves.toBe(false);
    expect(queue.pending).toEqual({ title: "Do not lose me" });

    await expect(pumpSaveQueue(queue, persist)).resolves.toBe(true);
    expect(persist).toHaveBeenLastCalledWith({ title: "Do not lose me" });
    expect(queue.pending).toBeNull();
  });
});
