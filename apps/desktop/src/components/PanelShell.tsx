import { useEffect, useRef, type ReactNode } from "react";

/**
 * The frame every tool page is drawn in: the engine's name above, the panel's
 * own content below. It sits in the main area and is left through the sidebar,
 * so there is no close button and no exit animation to wait for.
 *
 * Focus moves here on arrival, so someone who chose a tool from the keyboard
 * lands on it instead of back at the top of the sidebar.
 */
export function PanelShell({
  title,
  wide = false,
  bodyClassName = "",
  children,
}: {
  title: string;
  wide?: boolean;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const pageRef = useRef<HTMLElement>(null);
  useEffect(() => pageRef.current?.focus({ preventScroll: true }), []);

  return (
    <section
      ref={pageRef}
      tabIndex={-1}
      className={`tool-panel tool-panel--page${wide ? " tool-panel--wide" : ""}`}
      aria-labelledby="tool-panel-title"
    >
      <div className="tool-panel__topbar">
        <span>{title}</span>
      </div>
      <div className={`tool-panel__body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
    </section>
  );
}
