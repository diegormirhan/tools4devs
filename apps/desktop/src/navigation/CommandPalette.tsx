import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { searchCatalog, type CatalogRow, type CatalogTool } from "../catalog/catalog";
import { useT } from "../i18n/language";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useNavigation, type Location } from "./navigation";

/** Ctrl+K: every tool and every sub-tool, searched in both languages, keyboard only. */
/** A result: the group's own tinted tile, a title with its detail, and the group as a chip. */
function Result({
  hue,
  icon: Icon,
  title,
  detail,
  group,
}: {
  hue: number;
  icon: LucideIcon;
  title: string;
  detail?: string;
  group?: string;
}) {
  return (
    <span className="contents" style={{ "--hue": hue } as React.CSSProperties}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-group-tile text-group-icon">
        <Icon className="size-5" />
      </span>
      <span className="grid flex-1 gap-0.5">
        <span className="text-[15px] leading-tight font-medium">{title}</span>
        {detail && <small className="text-xs text-muted-foreground">{detail}</small>}
      </span>
      {group && <small className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{group}</small>}
    </span>
  );
}

export function CommandPalette({
  rows,
  open,
  onOpenChange,
  file,
  suggestedTools,
}: {
  rows: CatalogRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: string | null;
  suggestedTools: CatalogTool[];
}) {
  const t = useT();
  const { go } = useNavigation();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const list = useRef<HTMLDivElement>(null);
  // The catalog does the matching, so cmdk never re-selects on its own: without this the
  // highlight stayed on whatever row the arrow keys had reached, and the list scrolled
  // down to it as the results changed under it.
  function firstResult(text: string): string {
    if (file && !text.trim() && suggestedTools.length > 0) return `file/${suggestedTools[0].id}`;
    const found = searchCatalog(rows, text, t);
    const action = found.actions[0];
    return action ? `${action.tool.id}/${action.operation.id}` : (found.tools[0]?.tool.id ?? "");
  }
  function search(text: string) {
    setQuery(text);
    setSelected(firstResult(text));
    // New results start at the top; cmdk does not move the scroll when the selection resets.
    if (list.current) list.current.scrollTop = 0;
  }
  // Cleared as the palette opens, not as it closes: clearing on close swapped the
  // results for the full list while the dialog was still fading out.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) search("");
  }
  const { actions, tools } = searchCatalog(rows, query, t);

  function choose(destination: Location) {
    onOpenChange(false);
    go(destination);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[110px] translate-y-0 gap-0 overflow-hidden rounded-2xl bg-popover/90 p-0 shadow-2xl ring-1 ring-foreground/5 backdrop-blur-xl sm:max-w-[660px]"
      >
        <DialogTitle className="sr-only">{t("Search tools")}</DialogTitle>
        <DialogDescription className="sr-only">{t("Search an action, a format or a tool")}</DialogDescription>
        {/* The catalog does its own matching, accent-blind and in both languages. */}
        <Command
          shouldFilter={false}
          value={selected}
          onValueChange={setSelected}
          className="rounded-none bg-transparent **:data-[slot=command-input-wrapper]:h-16 **:data-[slot=command-input-wrapper]:gap-3 **:data-[slot=command-input-wrapper]:px-6 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[data-slot=command-input-wrapper]_svg]:size-5 [&_[data-slot=command-input-wrapper]_svg]:opacity-70"
        >
          <CommandInput
            value={query}
            onValueChange={search}
            placeholder={t("Search an action, a format or a tool")}
            aria-label={t("Search tools")}
            className="h-12 text-base"
          />
          <CommandList ref={list} className="max-h-[420px] px-3 py-3 [&_[cmdk-group]]:p-0 [&_[cmdk-group]:not(:first-child)]:mt-2">
            <CommandEmpty>{t("No tool matches that")}</CommandEmpty>
            {file && !query.trim() && suggestedTools.length > 0 && (
              <CommandGroup heading={t("For {name}", { name: file.split(/[\\/]/).pop() ?? file })}>
                {suggestedTools.map((tool) => {
                  const hue = rows.find((row) => row.tools.some((candidate) => candidate.id === tool.id))?.hue ?? 215;
                  return (
                    <CommandItem
                      key={tool.id}
                      value={`file/${tool.id}`}
                      onSelect={() => choose({ view: "tool", toolId: tool.id })}
                      className="gap-4 rounded-xl px-3 py-2.5 data-[selected=true]:bg-accent data-[selected=true]:ring-1 data-[selected=true]:ring-border"
                    >
                      <Result hue={hue} icon={tool.icon} title={t(tool.title)} group={tool.integrationName} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {actions.length > 0 && (
              <CommandGroup heading={t("Actions")}>
                {actions.map(({ row, tool, operation }) => {
                  return (
                    <CommandItem
                      key={`${tool.id}/${operation.id}`}
                      value={`${tool.id}/${operation.id}`}
                      onSelect={() => choose({ view: "tool", toolId: tool.id, subId: operation.id })}
                      className="gap-4 rounded-xl px-3 py-2.5 data-[selected=true]:bg-accent data-[selected=true]:ring-1 data-[selected=true]:ring-border"
                    >
                      <Result
                        hue={row.hue}
                        icon={tool.icon}
                        title={t(operation.label)}
                        detail={`${t(tool.title)} · ${tool.integrationName}`}
                        group={t(row.title)}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {tools.length > 0 && (
              <CommandGroup heading={t("Tools")}>
                {tools.map(({ row, tool }) => {
                  return (
                    <CommandItem
                      key={tool.id}
                      value={tool.id}
                      onSelect={() => choose({ view: "tool", toolId: tool.id })}
                      className="gap-4 rounded-xl px-3 py-2.5 data-[selected=true]:bg-accent data-[selected=true]:ring-1 data-[selected=true]:ring-border"
                    >
                      <Result
                        hue={row.hue}
                        icon={tool.icon}
                        title={t(tool.title)}
                        detail={t(tool.operations.length === 1 ? "{count} action" : "{count} actions", {
                          count: tool.operations.length,
                        })}
                        group={t(row.title)}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        <footer className="flex gap-6 border-t bg-muted/40 px-6 py-3.5 text-xs text-muted-foreground" aria-hidden="true">
          {[
            ["↑ ↓", t("move")],
            ["↵", t("open")],
            ["Esc", t("close")],
          ].map(([keys, label]) => (
            <span key={label} className="flex items-center gap-2">
              <kbd className="rounded-md border bg-background px-1.5 py-0.5 font-sans text-[11px] font-medium text-foreground shadow-xs">
                {keys}
              </kbd>
              {label}
            </span>
          ))}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
