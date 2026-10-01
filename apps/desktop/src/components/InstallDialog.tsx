import { Download, HardDrive, ShieldCheck } from "lucide-react";
import type { InstallationPlanStep } from "../../../../scripts/component-installation/resolve-installation-plan.mjs";
import type { InstallationState } from "../../../../scripts/component-installation/installation-state.mjs";
import type { CatalogTool } from "../catalog/catalog";
import { downloadSize, formatBytes } from "../catalog/sizes";
import { useT } from "../i18n/language";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";

type InstallDialogProps = {
  tool: CatalogTool;
  plan: InstallationPlanStep[];
  labelsById: Record<string, string>;
  states: Record<string, InstallationState>;
  canInstall: boolean;
  onInstall: () => void;
  /** Goes to the tool once everything it needs is in place. */
  onOpen: () => void;
  onClose: () => void;
};

/** English here, translated where it is shown. */
const phaseLabels: Record<InstallationState["phase"], string> = {
  idle: "Queued",
  resolving: "Preparing",
  downloading: "Downloading",
  verifying: "Verifying",
  installing: "Installing",
};

export function InstallDialog({
  tool,
  plan,
  labelsById,
  states,
  canInstall,
  onInstall,
  onOpen,
  onClose,
}: InstallDialogProps) {
  const steps = plan.length > 0 ? plan : [{ toolId: tool.id, reason: "requested" as const }];
  const busy = steps.some((step) => states[step.toolId]?.phase !== "idle");
  const failure = steps.map((step) => states[step.toolId]?.lastError).find(Boolean);
  const done = steps.every((step) => states[step.toolId]?.availability === "ready");
  // Stated before the download starts, not discovered halfway through it. One
  // of these components is over 200 MB, and that is the user's decision to make.
  const t = useT();
  const total = steps.reduce((sum, step) => sum + (downloadSize(step.toolId) ?? 0), 0);

  return (
    // A download in progress keeps the dialog open: closing it would hide the only progress there is.
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent showCloseButton={false} className="gap-5 sm:max-w-[520px]">
        <div className="grid size-12 place-items-center rounded-lg bg-primary/15 text-primary">
          <Download className="size-6" aria-hidden="true" />
        </div>
        <DialogTitle className="font-heading text-xl font-semibold tracking-tight">
          {t("Install {name}", { name: tool.integrationName })}
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">
          {canInstall
            ? total > 0
              ? t(
                  "Tools4Devs downloads and installs everything below on its own — {size} in total. You never leave the app, and you never install anything by hand.",
                  { size: formatBytes(total) },
                )
              : t(
                  "Tools4Devs downloads and installs everything below on its own. You never leave the app, and you never install anything by hand.",
                )
            : t(
                "This component has no pinned artifact and hash yet, so the app cannot install it. It only works if this Windows already has it.",
              )}
        </DialogDescription>

        <ol className="overflow-hidden rounded-md border" aria-label={t("Installation plan")}>
          {steps.map((step, index) => {
            const state = states[step.toolId];
            const progress = state?.progress == null ? null : Math.round(state.progress * 100);
            const ready = state?.availability === "ready";
            const name = labelsById[step.toolId] ?? step.toolId;
            return (
              <li key={step.toolId} className="flex items-center gap-3.5 border-b px-3.5 py-3 last:border-b-0">
                <span className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <span className="grid flex-1">
                  <strong className="font-medium">{name}</strong>
                  <small className="text-xs text-muted-foreground">
                    {ready
                      ? t("Ready")
                      : state && state.phase !== "idle"
                        ? `${t(phaseLabels[state.phase])}${progress == null ? "…" : ` ${progress}%`}`
                        : `${t(step.reason === "dependency" ? "Dependency" : "Requested tool")}${
                            downloadSize(step.toolId) ? ` · ${formatBytes(downloadSize(step.toolId)!)}` : ""
                          }`}
                  </small>
                </span>
                {state && state.phase !== "idle" && !ready && (
                  <Progress
                    value={progress}
                    className={cn("w-36", progress == null && "animate-pulse")}
                    aria-label={t("Progress of {name}", { name })}
                  />
                )}
              </li>
            );
          })}
        </ol>

        {failure && (
          <p className="text-sm text-destructive" role="alert">
            {failure}
          </p>
        )}

        <div className="grid gap-2 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {t("SHA-256 checked before anything is activated")}
          </span>
          <span className="flex items-center gap-2">
            <HardDrive className="size-4 text-primary" aria-hidden="true" />
            {t("Installed per version, with no administrator rights")}
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("Close")}
          </Button>
          {done ? (
            <Button onClick={onOpen}>{t("Open {name}", { name: tool.integrationName })}</Button>
          ) : (
            canInstall && (
              <Button onClick={onInstall} disabled={busy}>
                {t(busy ? "Installing…" : failure ? "Try again" : "Download and install")}
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
