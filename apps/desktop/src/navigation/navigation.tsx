import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type View = "catalog" | "tool" | "queue" | "history" | "settings";

/** Where the window is: a page, or a tool and one of its sub-tools. No router, no URL. */
export type Location = { view: View; toolId?: string; subId?: string };

type NavigationApi = {
  location: Location;
  /** Goes there, unless it would throw away unsaved work; then it waits in `pending`. */
  go: (next: Location, options?: { force?: boolean }) => void;
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  pending: Location | null;
  confirmPending: () => void;
  cancelPending: () => void;
};

const NavigationContext = createContext<NavigationApi | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Location>({ view: "catalog" });
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<Location | null>(null);
  // go() is handed to many children; reading the latest state through a ref keeps it stable.
  const current = useRef({ location, dirty });
  current.current = { location, dirty };

  const arrive = useCallback((next: Location) => {
    setLocation(next);
    setDirty(false);
    setPending(null);
  }, []);

  const go = useCallback(
    (next: Location, options?: { force?: boolean }) => {
      const { location: here, dirty: unsaved } = current.current;
      if (sameLocation(here, next)) return;
      // Another sub-tool of the same tool keeps the page, and the work on it.
      if (here.view === "tool" && next.view === "tool" && here.toolId === next.toolId) {
        setLocation(next);
        return;
      }
      if (unsaved && !options?.force && here.view === "tool") {
        setPending(next);
        return;
      }
      arrive(next);
    },
    [arrive],
  );

  const api = useMemo<NavigationApi>(
    () => ({
      location,
      go,
      dirty,
      setDirty,
      pending,
      confirmPending: () => pending && arrive(pending),
      cancelPending: () => setPending(null),
    }),
    [location, go, dirty, pending, arrive],
  );

  return <NavigationContext.Provider value={api}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationApi {
  const api = useContext(NavigationContext);
  if (!api) throw new Error("useNavigation needs a NavigationProvider above it.");
  return api;
}

function sameLocation(a: Location, b: Location): boolean {
  return a.view === b.view && a.toolId === b.toolId && a.subId === b.subId;
}
