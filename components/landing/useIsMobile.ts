"use client";

// Shared viewport hook for the landing page. SSR default is desktop
// (false); the big, flash-sensitive type uses clamp() so the initial
// desktop render still fits on a phone before hydration flips structure.

import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

const getSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;
const getServerSnapshot = () => false;

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
