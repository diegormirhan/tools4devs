import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it } from "vitest";
import { NavigationProvider, useNavigation } from "./navigation";

function setup() {
  const wrapper = ({ children }: { children: ReactNode }) => <NavigationProvider>{children}</NavigationProvider>;
  return renderHook(() => useNavigation(), { wrapper });
}

it("starts on the catalog and goes where it is sent", () => {
  const { result } = setup();
  expect(result.current.location).toEqual({ view: "catalog" });

  act(() => result.current.go({ view: "tool", toolId: "ffmpeg", subId: "extract-audio" }));
  expect(result.current.location).toEqual({ view: "tool", toolId: "ffmpeg", subId: "extract-audio" });
});

it("holds a move away from unsaved work until the person confirms it", () => {
  const { result } = setup();
  act(() => result.current.go({ view: "tool", toolId: "ffmpeg" }));
  act(() => result.current.setDirty(true));

  act(() => result.current.go({ view: "tool", toolId: "qpdf" }));
  expect(result.current.location).toEqual({ view: "tool", toolId: "ffmpeg" });
  expect(result.current.pending).toEqual({ view: "tool", toolId: "qpdf" });

  act(() => result.current.confirmPending());
  expect(result.current.location).toEqual({ view: "tool", toolId: "qpdf" });
  expect(result.current.pending).toBeNull();
  // The work belonged to the tool that was left, so nothing is unsaved any more.
  expect(result.current.dirty).toBe(false);
});

it("stays put when the person keeps editing", () => {
  const { result } = setup();
  act(() => result.current.go({ view: "tool", toolId: "ffmpeg" }));
  act(() => result.current.setDirty(true));
  act(() => result.current.go({ view: "queue" }));

  act(() => result.current.cancelPending());
  expect(result.current.location).toEqual({ view: "tool", toolId: "ffmpeg" });
  expect(result.current.pending).toBeNull();
  expect(result.current.dirty).toBe(true);
});

it("switches sub-tool without asking, since the page and its file stay", () => {
  const { result } = setup();
  act(() => result.current.go({ view: "tool", toolId: "ffmpeg", subId: "trim" }));
  act(() => result.current.setDirty(true));

  act(() => result.current.go({ view: "tool", toolId: "ffmpeg", subId: "crop" }));
  expect(result.current.pending).toBeNull();
  expect(result.current.location).toEqual({ view: "tool", toolId: "ffmpeg", subId: "crop" });
  // The page did not change, so neither did what is unsaved on it.
  expect(result.current.dirty).toBe(true);
});

it("moves at once when forced, or when going nowhere new", () => {
  const { result } = setup();
  act(() => result.current.go({ view: "tool", toolId: "ffmpeg" }));
  act(() => result.current.setDirty(true));

  act(() => result.current.go({ view: "tool", toolId: "ffmpeg" }));
  expect(result.current.pending).toBeNull();

  act(() => result.current.go({ view: "catalog" }, { force: true }));
  expect(result.current.location).toEqual({ view: "catalog" });
  expect(result.current.dirty).toBe(false);
});
