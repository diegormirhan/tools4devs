import { useEffect, useRef, type CSSProperties } from "react";
import { ArrowUpRight, Check, CloudDownload, Download } from "lucide-react";
import type { InstallationState } from "../../../../scripts/component-installation/installation-state.mjs";
import type { CatalogRow, CatalogTool } from "../catalog/catalog";
import { downloadSize, formatBytes } from "../catalog/sizes";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useT } from "../i18n/language";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

/** Long enough that sweeping the pointer across the grid opens nothing. */
const previewDelay = 300;
/** Operations named in the preview before the rest become "+N". */
const listedActions = 6;

/** English here, translated where it is shown. */
const phaseLabels: Record<InstallationState["phase"], string> = {
  idle: "",
  resolving: "Preparing",
  downloading: "Downloading",
  verifying: "Verifying",
  installing: "Installing",
};

type ToolCardProps = {
  tool: CatalogTool;
  row: CatalogRow;
  installation: InstallationState;
  onOpen: (tool: CatalogTool) => void;
  onInstall: (tool: CatalogTool) => void;
  /** Whether this card's preview is the one showing; the grid allows one at a time. */
  previewing: boolean;
  onPreviewChange: (open: boolean) => void;
};

/**
 * One tool in the catalog. The whole card is the button that opens the tool, or
 * fetches it first; pausing on it, or reaching it with Tab, shows a preview with
 * a short clip and what the tool can do.
 */
export function ToolCard({ tool, row, installation, onOpen, onInstall, previewing, onPreviewChange }: ToolCardProps) {
  const t = useT();
  const timer = useRef<number | undefined>(undefined);
  const isReady = installation.availability === "ready";
  const isBusy = installation.phase !== "idle";
  const progress = installation.progress == null ? null : Math.round(installation.progress * 100);
  const size = downloadSize(tool.id);
  const act = () => (isReady ? onOpen(tool) : onInstall(tool));
  const hue = { "--hue": row.hue } as CSSProperties;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function schedulePreview() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onPreviewChange(true), previewDelay);
  }

  function closePreview() {
    window.clearTimeout(timer.current);
    onPreviewChange(false);
  }

  const Icon = tool.icon;
  const availability = isReady
    ? t(installation.activeVersion === "bundled" ? "Included" : "Ready")
    : `${t(tool.downloadLabel ?? "Not installed")}${size ? ` · ${formatBytes(size)}` : ""}`;

  return (
    <article
      aria-labelledby={`card-${tool.id}`}
      className="group/card relative flex flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-xs transition-colors hover:border-ring/40"
      style={hue}
      onPointerEnter={schedulePreview}
      onPointerLeave={closePreview}
    >
      <button
        type="button"
        className="absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label={t(isReady ? "Open {name}" : "Get {name}", { name: tool.integrationName })}
        onClick={act}
        // Only focus from the keyboard opens it at once. A mouse click focuses the
        // button too, and a preview opening between press and release covered
        // the card, so the release landed on the preview and the click was lost.
        onFocus={(event) => {
          if (focusIsVisible(event.currentTarget)) onPreviewChange(true);
        }}
        onBlur={closePreview}
      />

      <header className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-group-tile text-group-icon">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <h3 id={`card-${tool.id}`} className="font-heading text-[17px] leading-tight font-semibold">
            {t(tool.title)}
          </h3>
          <span className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">{tool.integrationName}</span>
        </span>
        <Badge variant="outline" className="shrink-0">
          {t(tool.operations.length === 1 ? "{count} action" : "{count} actions", { count: tool.operations.length })}
        </Badge>
      </header>

      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{t(tool.description)}</p>

      {installation.lastError ? (
        <div className="relative z-10 grid gap-2" role="alert">
          <span className="text-sm text-destructive">{installation.lastError}</span>
          <Button variant="outline" size="sm" className="justify-self-start" onClick={() => onInstall(tool)}>
            {t("Try again")}
          </Button>
        </div>
      ) : isBusy ? (
        <div className="grid gap-2" aria-live="polite">
          <span className="flex justify-between text-xs text-muted-foreground">
            <span>{t(phaseLabels[installation.phase])}</span>
            {progress != null && <span>{progress}%</span>}
          </span>
          <Progress
            value={progress}
            className={progress == null ? "animate-pulse" : undefined}
            aria-label={t("Progress of {name}", { name: tool.integrationName })}
          />
        </div>
      ) : (
        <Badge variant="secondary" className="self-start">
          {isReady ? <Check aria-hidden="true" /> : <CloudDownload aria-hidden="true" />}
          {availability}
        </Badge>
      )}

      {previewing && <ToolPreview tool={tool} isReady={isReady} size={size} onAct={act} />}
    </article>
  );
}

/**
 * Drawn over the grid from the card, so opening it moves nothing else. It repeats
 * what the card's own button does, so it is hidden from assistive technology and
 * its button is left out of the tab order.
 */
function ToolPreview({
  tool,
  isReady,
  size,
  onAct,
}: {
  tool: CatalogTool;
  isReady: boolean;
  size: number | null;
  onAct: () => void;
}) {
  const t = useT();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const Icon = tool.icon;
  const hidden = tool.operations.length - listedActions;

  return (
    <div
      aria-hidden="true"
      className="absolute -top-4 -left-5 z-20 w-[calc(100%+40px)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-[0.98] duration-150"
    >
      <div className="grid aspect-video place-items-center bg-muted">
        {tool.preview && !reducedMotion ? (
          <video
            className="size-full object-cover"
            src={tool.preview.src}
            poster={tool.preview.poster}
            muted
            loop
            autoPlay
            playsInline
            preload="none"
          />
        ) : tool.preview ? (
          <img className="size-full object-cover" src={tool.preview.poster} alt="" />
        ) : (
          <Icon className="size-12 text-group-icon" />
        )}
      </div>
      <div className="grid gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-group-tile text-group-icon">
            <Icon className="size-5" />
          </span>
          <span className="grid min-w-0 flex-1">
            <b className="font-heading text-[17px] leading-tight font-semibold">{t(tool.title)}</b>
            <span className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
              {tool.integrationName}
              {!isReady && size ? ` · ${t("{size} download", { size: formatBytes(size) })}` : ""}
            </span>
          </span>
          <Button size="sm" tabIndex={-1} onClick={onAct}>
            {t(isReady ? "Open" : "Get it")}
            {isReady ? <ArrowUpRight /> : <Download />}
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{t(tool.description)}</p>
        <span className="text-xs font-medium text-muted-foreground">{t("What you can do")}</span>
        <div className="flex flex-wrap gap-1.5">
          {tool.operations.slice(0, listedActions).map((operation) => (
            <Badge key={operation.id} variant="outline">
              {t(operation.label)}
            </Badge>
          ))}
          {hidden > 0 && <Badge variant="secondary">+{hidden}</Badge>}
        </div>
      </div>
    </div>
  );
}

/** Whether focus arrived the way a keyboard brings it; true where the selector is unknown. */
function focusIsVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}
