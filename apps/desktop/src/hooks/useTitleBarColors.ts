import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isNativeHost } from "./useOperationRunner";
import type { ResolvedTheme } from "./useTheme";

/**
 * Paints the native title bar in the sidebar's colours, so the window reads as one
 * surface. Runs after `useTheme` has switched the tokens, which is why it takes the
 * resolved theme: the colours are read back from the stylesheet, never repeated here.
 */
export function useTitleBarColors(theme: ResolvedTheme) {
  useEffect(() => {
    if (!isNativeHost()) return;
    const style = getComputedStyle(document.documentElement);
    const background = toRgb(style.getPropertyValue("--sidebar"));
    const text = toRgb(style.getPropertyValue("--sidebar-foreground"));
    if (!background || !text) return;
    void invoke("paint_title_bar", { background, text }).catch(() => {
      // An unpainted title bar is cosmetic; the app works the same.
    });
  }, [theme]);
}

/** The tokens are oklch; the window frame takes plain RGB, so the canvas converts. */
function toRgb(cssColor: string): [number, number, number] | null {
  const context = document.createElement("canvas").getContext("2d");
  if (!context || !cssColor.trim()) return null;
  context.fillStyle = cssColor.trim();
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return [red!, green!, blue!];
}
