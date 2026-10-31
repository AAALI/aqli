import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchPaletteDocs } from "../CommandPalette";

describe("palette search", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not fetch a query cancelled before the debounce", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const cancel = searchPaletteDocs("workspace", "older", vi.fn(), vi.fn());
    cancel();
    await vi.advanceTimersByTimeAsync(160);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("aborts the old request and ignores its response even if the transport ignores abort", async () => {
    let finishOld!: (response: Response) => void;
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishOld = resolve; }))
      .mockResolvedValueOnce(Response.json({ results: [{ id: "new" }] }));
    vi.stubGlobal("fetch", fetcher);
    const onResults = vi.fn();
    const onError = vi.fn();
    const cancelOld = searchPaletteDocs("workspace", "old", onResults, onError);
    await vi.advanceTimersByTimeAsync(160);
    const signal = (fetcher.mock.calls[0][1] as RequestInit).signal;
    cancelOld();
    expect(signal?.aborted).toBe(true);
    const cancelNew = searchPaletteDocs("workspace", "new", onResults, onError);
    await vi.advanceTimersByTimeAsync(160);
    finishOld(Response.json({ results: [{ id: "old" }] }));
    await vi.runAllTimersAsync();
    expect(onResults).toHaveBeenCalledExactlyOnceWith([{ id: "new" }]);
    expect(onError).not.toHaveBeenCalled();
    cancelNew();
  });

  it("reports unsuccessful responses without treating them as empty matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    const onResults = vi.fn();
    const onError = vi.fn();
    const cancel = searchPaletteDocs("workspace", "bank & retry", onResults, onError);
    await vi.advanceTimersByTimeAsync(160);
    expect(fetch).toHaveBeenCalledWith("/api/search?q=bank%20%26%20retry&workspace_id=workspace", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(onError).toHaveBeenCalledOnce();
    expect(onResults).not.toHaveBeenCalled();
    cancel();
  });

  it("ignores a network failure after the palette closes", async () => {
    let reject!: (reason: Error) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((_, fail) => { reject = fail; })));
    const onError = vi.fn();
    const cancel = searchPaletteDocs("workspace", "query", vi.fn(), onError);
    await vi.advanceTimersByTimeAsync(160);
    cancel();
    reject(new Error("network"));
    await vi.runAllTimersAsync();
    expect(onError).not.toHaveBeenCalled();
  });
});
