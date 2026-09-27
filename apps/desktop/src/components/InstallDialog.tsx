import { Download, HardDrive, ShieldCheck, X } from "lucide-react";
import type { InstallationPlanStep } from "../../../../scripts/component-installation/resolve-installation-plan.mjs";
import type { InstallationState } from "../../../../scripts/component-installation/installation-state.mjs";
import type { CatalogTool } from "../catalog/catalog";
import { downloadSize, formatBytes } from "../catalog/sizes";
import { useT } from "../i18n/language";

type InstallDialogProps = {
  tool: CatalogTool;
  plan: InstallationPlanStep[];
  labelsById: Record<string, string>;
  states: Record<string, InstallationState>;
  canInstall: boolean;
  onInstall: () => void;
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
    <div
      className="dialog-layer"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <button className="icon-button install-dialog__close" type="button" onClick={onClose} aria-label={t("Close")}>
          <X size={18} />
        </button>
        <div className="dialog-icon">
          <Download size={24} aria-hidden="true" />
        </div>
        <h2 id="install-title">{t("Install {name}", { name: tool.integrationName })}</h2>
        <p className="install-dialog__lead">
          {canInstall
            ? total > 0
              ? t(
                  "tools4devs downloads and installs everything below on its own — {size} in total. You never leave the app, and you never install anything by hand.",
                  { size: formatBytes(total) },
                )
              : t(
                  "tools4devs downloads and installs everything below on its own. You never leave the app, and you never install anything by hand.",
                )
            : t(
                "This component has no pinned artifact and hash yet, so the app cannot install it. It only works if this Windows already has it.",
              )}
        </p>

        <div className="plan-list" aria-label={t("Installation plan")}>
          {steps.map((step, index) => {
            const state = states[step.toolId];
            const progress = state?.progress == null ? null : Math.round(state.progress * 100);
            const ready = state?.availability === "ready";
            return (
              <div className="plan-step" key={step.toolId}>
                <span className="plan-step__index">{String(index + 1).padStart(2, "0")}</span>
                <span className="plan-step__copy">
                  <strong>{labelsById[step.toolId] ?? step.toolId}</strong>
                  <small>
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
                  <div
                    className={`progress-track${state.progress == null ? " progress-track--indeterminate" : ""}`}
                    role="progressbar"
                    aria-label={t("Progress of {name}", { name: labelsById[step.toolId] ?? step.toolId })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress ?? undefined}
                  >
                    <span style={{ inlineSize: progress == null ? undefined : `${progress}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {failure && (
          <p className="install-dialog__error" role="alert">
            {failure}
          </p>
        )}

        <div className="dialog-assurances">
          <span>
            <ShieldCheck size={16} aria-hidden="true" /> {t("SHA-256 checked before anything is activated")}
          </span>
          <span>
            <HardDrive size={16} aria-hidden="true" /> {t("Installed per version, with no administrator rights")}
          </span>
        </div>
        <div className="dialog-actions">
          <button className="button button--quiet" type="button" onClick={onClose} disabled={busy}>
            {t("Close")}
          </button>
          {canInstall && !done && (
            <button className="button button--primary" type="button" onClick={onInstall} disabled={busy}>
              {t(busy ? "Installing…" : failure ? "Try again" : "Download and install")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
