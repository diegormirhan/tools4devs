import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type View = "catalog" | "tool" | "queue" | "history" | "settings" | "about";

/** Where the window is: a page, or a tool and one of its sub-tools. No router, no URL. */
export type Location = { view: View; toolId?: string; subId?: string };

type NavigationApi = {
  location: Location;
  /** Goes there, unless it would throw away unsaved work; then it waits in `pending`. */
  go: (next: Location, options?: { force?: boolean }) => void;
  /** Returns to the page before this one, through the same guard as `go`. */
  back: () => void;
  canGoBack: boolean;
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
  const [pending, setPending] = useState<Move | null>(null);
  // The pages behind this one, most recent last. Going back takes one off instead of adding one.
  const [history, setHistory] = useState<Location[]>([]);
  // go() is handed to many children; reading the latest state through a ref keeps it stable.
  const current = useRef({ location, dirty, history });
  current.current = { location, dirty, history };

  const move = useCallback((next: Move, keepWork: boolean) => {
    const { location: here } = current.current;
    setHistory((past) => (next.back ? past.slice(0, -1) : [...past, here].slice(-maxHistory)));
    setLocation(next.to);
    if (!keepWork) setDirty(false);
    setPending(null);
  }, []);

  const request = useCallback(
    (next: Move, force = false) => {
      const { location: here, dirty: unsaved } = current.current;
      if (sameLocation(here, next.to)) return;
      // Another sub-tool of the same tool keeps the page, and the work on it.
      if (here.view === "tool" && next.to.view === "tool" && here.toolId === next.to.toolId) {
        move(next, true);
        return;
      }
      if (unsaved && !force && here.view === "tool") {
        setPending(next);
        return;
      }
      move(next, false);
    },
    [move],
  );

  const go = useCallback((next: Location, options?: { force?: boolean }) => request({ to: next }, options?.force), [request]);
  const back = useCallback(() => {
    const previous = current.current.history.at(-1);
    if (previous) request({ to: previous, back: true });
  }, [request]);

  const api = useMemo<NavigationApi>(
    () => ({
      location,
      go,
      back,
      canGoBack: history.length > 0,
      dirty,
      setDirty,
      pending: pending?.to ?? null,
      confirmPending: () => pending && move(pending, false),
      cancelPending: () => setPending(null),
    }),
    [location, go, back, history.length, dirty, pending, move],
  );

  return <NavigationContext.Provider value={api}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationApi {
  const api = useContext(NavigationContext);
  if (!api) throw new Error("useNavigation needs a NavigationProvider above it.");
  return api;
}

type Move = { to: Location; back?: boolean };

const maxHistory = 50;

function sameLocation(a: Location, b: Location): boolean {
  return a.view === b.view && a.toolId === b.toolId && a.subId === b.subId;
}
