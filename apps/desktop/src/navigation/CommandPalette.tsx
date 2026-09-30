import { useState } from "react";
import { searchCatalog, type CatalogRow } from "../catalog/catalog";
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
export function CommandPalette({
  rows,
  open,
  onOpenChange,
}: {
  rows: CatalogRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const { go } = useNavigation();
  const [query, setQuery] = useState("");
  const { actions, tools } = searchCatalog(rows, query, t);

  function choose(destination: Location) {
    onOpenChange(false);
    setQuery("");
    go(destination);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent showCloseButton={false} className="top-[130px] translate-y-0 overflow-hidden p-0 sm:max-w-[580px]">
        <DialogTitle className="sr-only">{t("Search tools")}</DialogTitle>
        <DialogDescription className="sr-only">{t("Search an action, a format or a tool")}</DialogDescription>
        {/* The catalog does its own matching, accent-blind and in both languages. */}
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("Search an action, a format or a tool")}
            aria-label={t("Search tools")}
          />
          <CommandList className="max-h-[380px]">
            <CommandEmpty>{t("No tool matches that")}</CommandEmpty>
            {actions.length > 0 && (
              <CommandGroup heading={t("Actions")}>
                {actions.map(({ row, tool, operation }) => {
                  const Icon = tool.icon;
                  return (
                    <CommandItem
                      key={`${tool.id}/${operation.id}`}
                      value={`${tool.id}/${operation.id}`}
                      onSelect={() => choose({ view: "tool", toolId: tool.id, subId: operation.id })}
                      className="gap-3"
                    >
                      <Icon className="size-5" />
                      <span className="grid flex-1">
                        <span className="font-medium">{t(operation.label)}</span>
                        <small className="text-xs text-muted-foreground">
                          {t(tool.title)} · {tool.integrationName}
                        </small>
                      </span>
                      <small className="text-xs text-muted-foreground">{t(row.title)}</small>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {tools.length > 0 && (
              <CommandGroup heading={t("Tools")}>
                {tools.map(({ row, tool }) => {
                  const Icon = tool.icon;
                  return (
                    <CommandItem
                      key={tool.id}
                      value={tool.id}
                      onSelect={() => choose({ view: "tool", toolId: tool.id })}
                      className="gap-3"
                    >
                      <Icon className="size-5" />
                      <span className="grid flex-1">
                        <span className="font-medium">{t(tool.title)}</span>
                        <small className="text-xs text-muted-foreground">
                          {t(tool.operations.length === 1 ? "{count} action" : "{count} actions", {
                            count: tool.operations.length,
                          })}
                        </small>
                      </span>
                      <small className="text-xs text-muted-foreground">{t(row.title)}</small>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        <footer className="flex gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground" aria-hidden="true">
          <span>↑ ↓ {t("move")}</span>
          <span>↵ {t("open")}</span>
          <span>Esc {t("close")}</span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
