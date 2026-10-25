export type SavePumpState<Updates extends Record<string, unknown>> = {
  pending: Updates | null;
  inFlight: Promise<boolean> | null;
};

/**
 * Drain queued updates in order. Concurrent callers join the active drain, so
 * an action that depends on saved state can await the same work.
 */
export function pumpSaveQueue<Updates extends Record<string, unknown>>(
  state: SavePumpState<Updates>,
  persist: (updates: Updates) => Promise<boolean>,
): Promise<boolean> {
  if (state.inFlight) return state.inFlight;

  const run = async (): Promise<boolean> => {
    while (state.pending !== null) {
      const updates = state.pending;
      state.pending = null;

      let ok = false;
      try {
        ok = await persist(updates);
      } catch {
        // A rejected save is the same as a failed one: preserve it for retry.
      }

      if (!ok) {
        // Newer edits win field-by-field if they arrived during this request.
        state.pending = { ...updates, ...(state.pending ?? {}) };
        return false;
      }
    }
    return true;
  };

  const inFlight = run().finally(() => {
    if (state.inFlight === inFlight) state.inFlight = null;
  });
  state.inFlight = inFlight;
  return inFlight;
}
