import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const storageKey = "tools4devs.theme-preference";
const darkQuery = "(prefers-color-scheme: dark)";

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => (matchesDark() ? "dark" : "light"));
  const resolvedTheme: ResolvedTheme = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    const media = window.matchMedia?.(darkQuery);
    if (!media?.addEventListener) return;
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    // Surfaces animate their background at different speeds, so a live swap tears the
    // frame. Suppress transitions for the swap itself and restore them right after.
    root.dataset.themeSwitching = "true";
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => delete root.dataset.themeSwitching),
    );
    return () => cancelAnimationFrame(frame);
  }, [resolvedTheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // A blocked storage must not break theming; the choice simply lasts one session.
    }
  }, []);

  return { preference, resolvedTheme, setPreference };
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Fall through to the system preference.
  }
  return "system";
}

function matchesDark(): boolean {
  return window.matchMedia?.(darkQuery).matches ?? true;
}
