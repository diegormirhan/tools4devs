import { useEffect, useRef, type ReactNode } from "react";
import type { CatalogTool } from "../catalog/catalog";
import { useT } from "../i18n/language";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

/**
 * The page a tool is drawn on: title, description and engine on top, the
 * tool's own content below. It sits in the main area and is left through the
 * sidebar, so there is no close button.
 *
 * Focus moves here on arrival, so someone who chose a tool from the keyboard
 * lands on it instead of back at the top of the sidebar.
 */
export function ToolPage({
  tool,
  title,
  description,
  showEngine = true,
  className,
  children,
}: {
  tool: CatalogTool;
  /** Already translated; the tool's own title when absent. */
  title?: string;
  /** Already translated; the tool's own description when absent. */
  description?: string;
  /** The engine's name in a badge. What the app does itself has none to show. */
  showEngine?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = useT();
  const pageRef = useRef<HTMLElement>(null);
  useEffect(() => pageRef.current?.focus({ preventScroll: true }), []);

  return (
    <section
      ref={pageRef}
      tabIndex={-1}
      data-slot="page"
      className={cn("grid gap-6 px-6 pt-4 pb-16 outline-none lg:px-8", className)}
      aria-labelledby="tool-panel-title"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1.5">
          <h1 id="tool-panel-title" className="font-heading text-3xl font-semibold tracking-tight">
            {title ?? t(tool.title)}
          </h1>
          <p className="text-muted-foreground">{description ?? t(tool.description)}</p>
        </div>
        {showEngine && (
          <Badge variant="outline" className="font-mono uppercase">
            {tool.integrationName}
          </Badge>
        )}
      </header>
      {children}
    </section>
  );
}

/** A titled card in a tool page's column. */
export function PageCard({
  title,
  className,
  children,
  ...rest
}: { title?: string; className?: string; children: ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("grid gap-5 rounded-xl border bg-card p-6 text-card-foreground shadow-xs", className)}
      {...rest}
    >
      {title && <h2 className="font-heading text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

/** Says, before the fact, that something leaves this machine. */
export function OutboundNotice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-lg border bg-muted/50 p-3 text-sm text-foreground [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-primary">
      {icon}
      <span>{children}</span>
    </p>
  );
}

/** The outcome of a run, an error drawn as one. */
export function PageResult({
  error = false,
  icon,
  children,
  ref,
}: {
  error?: boolean;
  icon: ReactNode;
  children: ReactNode;
  ref?: React.Ref<HTMLParagraphElement>;
}) {
  return (
    <p
      ref={ref}
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-xl border p-4 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0",
        error ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-muted",
      )}
    >
      {icon}
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
