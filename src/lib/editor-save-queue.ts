type Updates = Record<string, unknown>;

/**
 * One save at a time, including edits queued while a request is in flight.
 * Every flush caller waits for the same pump, so Publish cannot overtake it.
 * Failed fields stay queued; newer edits win when that snapshot is retried.
 */
export function createEditorSaveQueue(persist: (updates: Updates) => Promise<boolean | "queued">) {
  let pending: Updates | null = null;
  let inFlight: Promise<boolean> | null = null;
  let queuedForReview = false;

  function enqueue(updates: Updates) {
    pending = { ...(pending ?? {}), ...updates };
  }

  function flush(): Promise<boolean> {
    if (inFlight) return inFlight;
    if (!pending) return Promise.resolve(true);
    inFlight = (async () => {
      while (pending) {
        const updates: Updates = pending;
        pending = null;
        let saved: boolean | "queued" = false;
        try {
          saved = await persist(updates);
        } finally {
          if (!saved) pending = { ...updates, ...(pending ?? {}) };
        }
        if (!saved) return false;
        queuedForReview = saved === "queued";
      }
      return true;
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  return {
    enqueue,
    flush,
    hasUnsavedChanges: () => pending !== null || inFlight !== null,
    needsReview: () => queuedForReview,
  };
}
