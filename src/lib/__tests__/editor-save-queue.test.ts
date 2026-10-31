import { describe, expect, it, vi } from "vitest";
import { createEditorSaveQueue } from "../editor-save-queue";

function deferred() {
  let resolve!: (saved: boolean) => void;
  const promise = new Promise<boolean>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("editor save queue", () => {
  it("merges title and body before a flush, keeping the latest field values", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const queue = createEditorSaveQueue(persist);
    queue.enqueue({ title: "A", body_md: "Old body" });
    queue.enqueue({ title: "B" });
    queue.enqueue({ body_md: "New body" });
    expect(queue.hasUnsavedChanges()).toBe(true);
    expect(await queue.flush()).toBe(true);
    expect(persist).toHaveBeenCalledExactlyOnceWith({ title: "B", body_md: "New body" });
    expect(queue.hasUnsavedChanges()).toBe(false);
  });

  it("makes publish wait for the current request and every newer queued edit", async () => {
    const first = deferred();
    const second = deferred();
    const persist = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const queue = createEditorSaveQueue(persist);
    queue.enqueue({ body_md: "First" });
    const autosave = queue.flush();
    queue.enqueue({ title: "Renamed" });
    queue.enqueue({ body_md: "Latest" });
    const publishFlush = queue.flush();
    const published = vi.fn();
    void publishFlush.then(published);
    expect(publishFlush).toBe(autosave);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(queue.hasUnsavedChanges()).toBe(true);
    first.resolve(true);
    await Promise.resolve();
    expect(persist).toHaveBeenLastCalledWith({ title: "Renamed", body_md: "Latest" });
    expect(published).not.toHaveBeenCalled();
    second.resolve(true);
    expect(await publishFlush).toBe(true);
    expect(published).toHaveBeenCalledWith(true);
    expect(queue.hasUnsavedChanges()).toBe(false);
  });

  it("reports a failed flush to all callers and preserves newer fields for retry", async () => {
    const first = deferred();
    const persist = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(true);
    const queue = createEditorSaveQueue(persist);
    queue.enqueue({ title: "Old", body_md: "Keep this body" });
    const autosave = queue.flush();
    queue.enqueue({ title: "Latest" });
    const publishFlush = queue.flush();
    first.resolve(false);
    expect(await autosave).toBe(false);
    expect(await publishFlush).toBe(false);
    expect(queue.hasUnsavedChanges()).toBe(true);
    expect(await queue.flush()).toBe(true);
    expect(persist).toHaveBeenLastCalledWith({ title: "Latest", body_md: "Keep this body" });
    expect(queue.hasUnsavedChanges()).toBe(false);
  });

  it("retains a snapshot if the persistence callback throws", async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(true);
    const queue = createEditorSaveQueue(persist);
    queue.enqueue({ title: "Do not lose me" });
    await expect(queue.flush()).rejects.toThrow("Offline");
    expect(queue.hasUnsavedChanges()).toBe(true);
    expect(await queue.flush()).toBe(true);
    expect(persist).toHaveBeenLastCalledWith({ title: "Do not lose me" });
  });

  it("does not send a request for an empty queue", async () => {
    const persist = vi.fn();
    const queue = createEditorSaveQueue(persist);
    expect(await queue.flush()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
    expect(queue.hasUnsavedChanges()).toBe(false);
  });

  it("distinguishes a safely queued proposal from applied content", async () => {
    const persist = vi.fn().mockResolvedValueOnce("queued").mockResolvedValueOnce(true);
    const queue = createEditorSaveQueue(persist);
    queue.enqueue({ body_md: "Proposed" });
    expect(await queue.flush()).toBe(true);
    expect(queue.hasUnsavedChanges()).toBe(false);
    expect(queue.needsReview()).toBe(true);
    queue.enqueue({ body_md: "Applied" });
    expect(await queue.flush()).toBe(true);
    expect(queue.needsReview()).toBe(false);
  });
});
