import type { ReactNode } from "react";

/** A page's serif title, the line under it, and the one action that belongs to the whole page. */
export function PageHeader({ title, lead, action }: { title: string; lead?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="grid gap-1.5">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        {lead && <p className="text-muted-foreground">{lead}</p>}
      </div>
      {action}
    </header>
  );
}
