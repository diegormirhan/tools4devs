import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useT } from "../i18n/language";
import { isNativeHost } from "../hooks/useOperationRunner";
import { cn } from "@/lib/cn";

/**
 * Minimise, maximise and close, drawn by the app because the window has no title bar:
 * Windows only draws its own buttons inside its own bar, which could not line up with
 * the header. The glyphs come from the system's icon font, so they match Windows 11
 * (Segoe Fluent Icons) or 10 (Segoe MDL2 Assets).
 */
export function WindowControls() {
  const t = useT();
  const [maximised, setMaximised] = useState(false);
  const snapTimer = useRef<number>(undefined);

  useEffect(() => {
    if (!isNativeHost()) return;
    const appWindow = getCurrentWindow();
    const follow = () => void appWindow.isMaximized().then(setMaximised).catch(() => undefined);
    follow();
    const listening = appWindow.onResized(follow);
    return () => void listening.then((stop) => stop()).catch(() => undefined);
  }, []);

  if (!isNativeHost()) return null;
  const appWindow = getCurrentWindow();

  return (
    <div className="-mr-4 flex shrink-0 self-stretch">
      <CaptionButton label={t("Minimise")} glyph={"\uE921"} onClick={() => void appWindow.minimize()} />
      <CaptionButton
        label={t(maximised ? "Restore" : "Maximise")}
        glyph={maximised ? "\uE923" : "\uE922"}
        onClick={() => void appWindow.toggleMaximize()}
        // A pause over maximise opens the Windows 11 snap layouts, as over the system's own button.
        onPointerEnter={() => {
          snapTimer.current = window.setTimeout(() => void invoke("show_snap_layouts").catch(() => undefined), 500);
        }}
        onPointerLeave={() => window.clearTimeout(snapTimer.current)}
      />
      <CaptionButton label={t("Close")} glyph={"\uE8BB"} close onClick={() => void appWindow.close()} />
    </div>
  );
}

function CaptionButton({
  label,
  glyph,
  close = false,
  ...props
}: { label: string; glyph: string; close?: boolean } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={-1}
      className={cn(
        "grid h-full w-[46px] place-items-center text-[10px] text-foreground/80 transition-colors hover:text-foreground",
        close ? "rounded-tr-xl hover:bg-[#c42b1c] hover:text-white active:bg-[#c42b1c]/85" : "hover:bg-foreground/8 active:bg-foreground/12",
      )}
      {...props}
    >
      <span aria-hidden="true" style={{ fontFamily: '"Segoe Fluent Icons", "Segoe MDL2 Assets"' }}>
        {glyph}
      </span>
    </button>
  );
}
