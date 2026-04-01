"use client";

import { useSyncExternalStore } from "react";

/** Minimum size for programme / forecast tabs (spreadsheet-style UI). */
const MEDIA_QUERY = "(min-width: 768px) and (min-height: 520px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(MEDIA_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return true;
}

/** True when the viewport is large enough for the project workspace. SSR defaults to true. */
export function useViewportFitsProjectWorkspace(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
