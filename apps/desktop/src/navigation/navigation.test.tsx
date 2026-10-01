import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it } from "vitest";
import { NavigationProvider, useNavigation } from "./navigation";

function setup() {
  const wrapper = ({ children }: { children: ReactNode }) => <NavigationProvider>{children}</NavigationProvider>;
  return renderHook(() => useNavigation(), { wrapper });
}

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

