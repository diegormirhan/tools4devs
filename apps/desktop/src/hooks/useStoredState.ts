import { useEffect, useState } from "react";

/**
 * State that survives a restart, kept as JSON under a tools4devs.* key. A value
 * that does not parse, or a storage that refuses, falls back to the default:
 * a lost preference is never worth a broken window.
 */
export function useStoredState<T>(key: string, fallback: T, accept: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      const parsed: unknown = raw == null ? undefined : JSON.parse(raw);
      return accept(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // A blocked store costs the preference, never the session.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
