import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import {
  createInstallationState,
  type InstallationState,
} from "../../../../scripts/component-installation/installation-state.mjs";
import type { CatalogRow, CatalogTool } from "../catalog/catalog";
import { useT } from "../i18n/language";
import { Button } from "@/components/ui/button";
import { ToolCard } from "./ToolCard";

/**
 * A card the app itself provides has nothing to install and no manifest entry,
 * so it has no installation state either. It is ready from the moment the window opens.
 */
const builtIn: InstallationState = createInstallationState({ activeVersion: "built-in" });

/** The home page: every group as a section of cards, and the file someone brought, if any. */
export function CatalogView({
  rows,
  installations,
  onOpen,
  onInstall,
  file,
  fileMessage,
  dragging,
  onChooseFile,
  suggestedTools,
}: {
  rows: CatalogRow[];
  installations: Record<string, InstallationState>;
  onOpen: (tool: CatalogTool) => void;
  onInstall: (tool: CatalogTool) => void;
  file: string | null;
  fileMessage: string;
  dragging: boolean;
  onChooseFile: () => void;
  suggestedTools: CatalogTool[];
}) {
  const t = useT();
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const fileName = file?.split(/[\\/]/).pop();

  return (
    // data-slot brings the page under the scoped reset in theme.css, like a shadcn component.
    <div data-slot="catalog" className="grid gap-10 px-6 pt-4 pb-16 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1.5">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("What do you want to do?")}</h1>
          <p className="text-muted-foreground">
            {t("Pick a tool on the left, or drop a file on this window and we will suggest what fits.")}
          </p>
        </div>
        <Button variant="outline" onClick={onChooseFile}>
          <Upload />
          {t("Choose a file")}
        </Button>
      </header>

      {(dragging || file || fileMessage) && (
        <section
          className="grid gap-3 rounded-xl border border-dashed bg-card p-4 data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5"
          data-dragging={dragging}
          aria-label={t("Your file")}
        >
          {dragging ? (
            <p className="flex items-center gap-3 font-medium">
              <Upload className="size-5 text-primary" aria-hidden="true" />
              {t("Drop the file here")}
            </p>
          ) : (
            fileName && (
              <p className="flex items-center gap-3">
                <FileText className="size-5 text-primary" aria-hidden="true" />
                <b className="font-medium">{fileName}</b>
                <span className="text-sm text-muted-foreground">
                  {t(suggestedTools.length > 0 ? "These tools read it:" : "No tool here is made for this kind of file.")}
                </span>
              </p>
            )
          )}
          {!dragging && suggestedTools.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("Tools that read this file")}>
              {suggestedTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Button key={tool.id} variant="secondary" size="sm" onClick={() => onOpen(tool)}>
                    <Icon />
                    {t(tool.title)}
                  </Button>
                );
              })}
            </div>
          )}
          {fileMessage && (
            <p className="text-sm text-destructive" role="alert">
              {fileMessage}
            </p>
          )}
        </section>
      )}

      {rows.map((row) => (
        <section key={row.id} id={`section-${row.id}`} aria-labelledby={`${row.id}-heading`} className="grid gap-3">
          <header className="flex items-baseline justify-between gap-4">
            <h2 id={`${row.id}-heading`} className="font-heading text-xl font-semibold tracking-tight">
              {t(row.title)}
            </h2>
            <span className="text-sm text-muted-foreground">
              {t(row.tools.length === 1 ? "{count} tool" : "{count} tools", { count: row.tools.length })}
            </span>
          </header>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {row.tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                row={row}
                installation={installations[tool.id] ?? builtIn}
                onOpen={onOpen}
                onInstall={onInstall}
                previewing={previewingId === tool.id}
                onPreviewChange={(open) =>
                  setPreviewingId((current) => (open ? tool.id : current === tool.id ? null : current))
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
