import { AlertTriangle, Download, RefreshCw, X } from "lucide-react";
import type { UpdateState } from "../hooks/useUpdate";
import { useT } from "../i18n/language";
import { Button } from "@/components/ui/button";

/**
 * Says what the update is doing, and nothing when it is doing nothing.
 *
 * It arrives from above and stops just under the header, over the page rather
 * than pushing it down: the news is worth noticing once, and the window
 * underneath it is not rearranged to carry it.
 */
export function UpdateCard({
  state,
  onRestart,
  onDismiss,
}: {
  state: UpdateState;
  onRestart: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  // "checking" and "current" are answers to a button in Settings, and are
  // reported there; a banner for them would be an interruption saying nothing
  // happened.
  if (state.phase === "idle" || state.phase === "checking" || state.phase === "current") {
    return null;
  }

  const percentage =
    state.phase === "downloading" && state.progress != null ? Math.round(state.progress * 100) : null;
  const Icon = state.phase === "downloading" ? Download : state.phase === "ready" ? RefreshCw : AlertTriangle;

  return (
    <aside
      data-slot="update-card"
      role="status"
      className="fixed top-16 right-6 z-50 flex w-[min(440px,calc(100vw-48px))] items-start gap-3 rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-top-4 duration-300"
    >
      <Icon className={state.phase === "failed" ? "mt-0.5 size-4 shrink-0 text-destructive" : "mt-0.5 size-4 shrink-0 text-primary"} aria-hidden="true" />
      <div className="grid flex-1 gap-3">
        <span>
          {state.phase === "downloading" &&
            `${t("Downloading version {version}", { version: state.version })}${percentage == null ? "…" : ` — ${percentage}%`}`}
          {state.phase === "ready" &&
            t("Version {version} is installed. Restart to use it — anything running now will be lost.", {
              version: state.version,
            })}
          {state.phase === "failed" && t("The update could not be installed: {message}", { message: state.message })}
        </span>
        {state.phase === "ready" && (
          <Button size="sm" className="justify-self-start" onClick={onRestart}>
            {t("Restart")}
          </Button>
        )}
      </div>
      {state.phase !== "downloading" && (
        <Button variant="ghost" size="icon" className="-m-1.5 size-7" onClick={onDismiss} aria-label={t("Dismiss")}>
          <X />
        </Button>
      )}
    </aside>
  );
}
