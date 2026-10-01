import { useSyncExternalStore } from "react";

/** Whether a media query matches now, following it as the window or the setting changes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia?.(query);
      media?.addEventListener?.("change", onChange);
      return () => media?.removeEventListener?.("change", onChange);
    },
    () => window.matchMedia?.(query).matches ?? false,
  );
}
