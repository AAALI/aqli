"use client";

import { useSyncExternalStore } from "react";

/**
 * Open/closed state for the mobile sidebar drawer.
 *
 * The toggle lives in the top bar and the drawer lives in the workspace layout,
 * so the two are in different React trees and cannot share state through props.
 * A module-level store is the smallest thing that connects them without
 * threading a context provider through every screen.
 */

let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setMobileNav(next: boolean) {
  if (open === next) return;
  open = next;
  emit();
}

export function toggleMobileNav() {
  setMobileNav(!open);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMobileNav(): boolean {
  // The server always renders the drawer closed; opening is a client gesture.
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
