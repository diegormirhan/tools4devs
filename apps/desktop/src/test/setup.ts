import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// The queue and the settings live in localStorage now, so one test's jobs would
// otherwise be waiting in the next one's history.
afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    // A jsdom without storage is fine; there is nothing to leak.
  }
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// jsdom ships no layout engine and therefore no ResizeObserver; the rails only use it
// to decide whether their arrows are enabled.
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", { writable: true, value: TestResizeObserver });

// The command palette scrolls the highlighted result into view; jsdom has no layout to scroll.
Element.prototype.scrollIntoView = function scrollIntoView() {};
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
