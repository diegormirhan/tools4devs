import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, Check, CircleSlash, Copy, FileQuestion, FolderOpen, type LucideIcon } from "lucide-react";
import type { ToolJob } from "../domain/job-queue";
import { useT, type Translate } from "../i18n/language";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ClearHistoryDialog } from "./ClearHistoryDialog";
import { PageHeader } from "./PageHeader";

export function JobView({
  activeNavigation,
  runningJobs,
  finishedJobs,
  onClearHistory,
  onCancel,
  onReturn,
  iconFor,
}: {
  activeNavigation: "queue" | "history";
  runningJobs: ToolJob[];
  finishedJobs: ToolJob[];
  onClearHistory: () => void;
  onCancel: (jobId: string) => void;
  onReturn: () => void;
  /** The icon of the tool that ran the job, so a row is recognised before it is read. */
  iconFor: (toolId: string) => LucideIcon | undefined;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const isQueue = activeNavigation === "queue";
  const jobs = isQueue ? runningJobs : finishedJobs;
  const lead = jobs.length
    ? t(jobs.length === 1 ? "{count} operation in this section." : "{count} operations in this section.", {
        count: jobs.length,
      })
    : t(isQueue ? "Nothing is running right now." : "Nothing has finished yet.");

  return (
    <div data-slot="page" className="grid max-w-[940px] gap-6 px-6 pt-4 pb-16 lg:px-8">
      <PageHeader
        title={t(isQueue ? "Operation queue" : "Result history")}
        lead={lead}
        action={
          !isQueue &&
          jobs.length > 0 && (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              {t("Clear the history")}
            </Button>
          )
        }
      />

      {jobs.length ? (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} icon={iconFor(job.toolId)} onCancel={isQueue ? onCancel : undefined} />
          ))}
        </div>
      ) : (
        <section className="grid justify-items-start gap-2 rounded-xl border border-dashed p-8">
          <h2 className="font-heading text-lg font-semibold">{t(isQueue ? "Nothing running" : "No results yet")}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t(
              isQueue
                ? "An operation started from a tool panel keeps running here after you close the panel, and can be stopped from here."
                : "Everything this app has run, kept across restarts until you clear it.",
            )}
          </p>
          <Button variant="outline" className="mt-2" onClick={onReturn}>
            {t("Back to the tools")}
          </Button>
        </section>
      )}

      <ClearHistoryDialog open={confirming} onOpenChange={setConfirming} onConfirm={onClearHistory} />
    </div>
  );
}

/** Left in English here; each is put through the translator where it is shown. */
const statusLabels: Record<ToolJob["status"], string> = {
  queued: "Waiting",
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Stopped",
  interrupted: "Interrupted",
};

function JobRow({ job, icon, onCancel }: { job: ToolJob; icon?: LucideIcon; onCancel?: (jobId: string) => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [revealError, setRevealError] = useState("");
  const percentage = job.progress == null ? null : Math.round(job.progress * 100);
  const failed = job.status === "failed" || job.status === "interrupted";
  const optionsLabel = Object.entries(job.options)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
  const Icon = icon ?? FileQuestion;

  async function copyOutputPath() {
    if (!job.outputPath) return;
    try {
      await navigator.clipboard?.writeText(job.outputPath);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the path stays on the buttons' tooltip.
    }
  }

  function revealOutput() {
    setRevealError("");
    void invoke("reveal_path", { path: job.outputPath }).catch((error) => setRevealError(describeError(error)));
  }

  return (
    <article
      className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4 text-card-foreground shadow-xs"
      aria-label={`${t(job.operationLabel)} — ${t(job.toolName)}`}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <strong className="font-semibold">{t(job.operationLabel)}</strong>
        <span className="truncate text-sm text-muted-foreground">
          {t(job.toolName)} · {job.sourceLabel}
          {optionsLabel ? ` · ${optionsLabel}` : ""}
        </span>
        {job.message && (
          <span className={failed ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {hostMessage(job.message, t)}
          </span>
        )}
        {job.outputPath && (
          // The path itself is not shown: it is one long line that pushed the row
          // wide and told nobody anything they could act on. The two things anybody
          // does with it are here instead, and the whole path is on their tooltip.
          <span className="-ml-3 mt-1.5 flex gap-1">
            <Button variant="ghost" size="sm" title={job.outputPath} onClick={revealOutput}>
              <FolderOpen aria-hidden="true" /> {t("Show in folder")}
            </Button>
            <Button variant="ghost" size="sm" title={job.outputPath} onClick={() => void copyOutputPath()} aria-live="polite">
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {t(copied ? "Copied" : "Copy path")}
            </Button>
          </span>
        )}
        {revealError && (
          <span className="text-sm text-destructive" role="alert">
            {t(revealError)}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Badge
          variant={job.status === "running" ? "secondary" : "outline"}
          className={failed ? "border-destructive/30 bg-destructive/10 text-destructive" : job.status === "running" ? "bg-primary/15 text-primary" : undefined}
        >
          {job.status === "succeeded" && <Check aria-hidden="true" />}
          {failed && <AlertTriangle aria-hidden="true" />}
          {(job.status === "cancelled" || job.status === "queued") && <CircleSlash aria-hidden="true" />}
          {t(statusLabels[job.status])}
          {job.status === "running" && percentage != null ? ` ${percentage}%` : ""}
        </Badge>
        {job.status === "running" && (
          <Progress
            value={percentage}
            className={percentage == null ? "w-36 animate-pulse" : "w-36"}
            aria-label={t("Progress of {name}", { name: job.operationLabel })}
          />
        )}
        {onCancel && (job.status === "running" || job.status === "queued") && (
          <Button variant="outline" size="sm" onClick={() => onCancel(job.id)}>
            <CircleSlash aria-hidden="true" /> {t("Stop")}
          </Button>
        )}
      </div>
    </article>
  );
}

/**
 * Translates what the host said about a job.
 *
 * The host speaks English, like the rest of the source, and most of what it
 * says is a fixed sentence the dictionary holds. Two carry a value inside
 * them, so they are matched rather than looked up; anything unrecognised is
 * shown exactly as it arrived, which is right for a tool's own error text.
 */
function hostMessage(message: string, t: Translate): string {
  const starting = /^Starting (.+)…$/.exec(message);
  if (starting) return t("Starting {name}…", { name: starting[1]! });

  const enlarged = /^Image enlarged (.+)× with Lanczos3\.$/.exec(message);
  if (enlarged) return t("Image enlarged {factor}× with Lanczos3.", { factor: enlarged[1]! });

  return t(message);
}

/** What an error from the host is, once it stops being unknown. */
function describeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "That file could not be shown.";
}
