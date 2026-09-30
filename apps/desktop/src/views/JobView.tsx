import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, Check, CircleSlash, Copy, FolderOpen } from "lucide-react";
import type { ToolJob } from "../domain/job-queue";
import { useT, type Translate } from "../i18n/language";

export function JobView({
  activeNavigation,
  runningJobs,
  finishedJobs,
  onClearHistory,
  onCancel,
  onReturn,
}: {
  activeNavigation: "queue" | "history";
  runningJobs: ToolJob[];
  finishedJobs: ToolJob[];
  onClearHistory: () => void;
  onCancel: (jobId: string) => void;
  onReturn: () => void;
}) {
  const t = useT();
  const isQueue = activeNavigation === "queue";
  const jobs = isQueue ? runningJobs : finishedJobs;
  const title = t(isQueue ? "Operation queue" : "Result history");
  const emptyTitle = t(isQueue ? "Nothing running" : "No results yet");
  const emptyDescription = t(
    isQueue
      ? "An operation started from a tool panel keeps running here after you close the panel, and can be stopped from here."
      : "Everything this app has run, kept across restarts until you clear it.",
  );
  const lead = jobs.length
    ? t(jobs.length === 1 ? "{count} operation in this section." : "{count} operations in this section.", {
        count: jobs.length,
      })
    : t(isQueue ? "Nothing is running right now." : "Nothing has finished yet.");

  return (
    <section className="job-view">
      <div className="job-view__header">
        <span className="placeholder-view__line" aria-hidden="true" />
        <h1>{title}</h1>
        <p>{lead}</p>
        {!isQueue && jobs.length > 0 && (
          <button className="button button--quiet button--small" type="button" onClick={onClearHistory}>
            {t("Clear the history")}
          </button>
        )}
      </div>
      {jobs.length ? (
        <div className="job-list">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} onCancel={isQueue ? onCancel : undefined} />
          ))}
        </div>
      ) : (
        <div className="job-empty">
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
          <button className="button button--light" type="button" onClick={onReturn}>
            {t("Back to the tools")}
          </button>
        </div>
      )}
    </section>
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

function JobRow({ job, onCancel }: { job: ToolJob; onCancel?: (jobId: string) => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [revealError, setRevealError] = useState("");
  const percentage = job.progress == null ? null : Math.round(job.progress * 100);
  const optionsLabel = Object.entries(job.options)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
  async function copyOutputPath() {
    if (!job.outputPath) return;
    try {
      await navigator.clipboard?.writeText(job.outputPath);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the path stays visible in the row.
    }
  }

  function revealOutput() {
    setRevealError("");
    void invoke("reveal_path", { path: job.outputPath }).catch((error) =>
      setRevealError(describeError(error)),
    );
  }

  return (
    <article className={`job-row job-row--${job.status}`} aria-label={`${t(job.operationLabel)} — ${t(job.toolName)}`}>
      <div className="job-row__identity">
        <strong>{t(job.operationLabel)}</strong>
        <span>
          {t(job.toolName)} · {job.sourceLabel}
          {optionsLabel ? ` · ${optionsLabel}` : ""}
        </span>
        <span className="job-row__message">{hostMessage(job.message, t)}</span>
        {job.outputPath && (
          // The path itself is not shown: it is one long monospace line that
          // pushed the row wide and told nobody anything they could act on.
          // The two things anybody does with it are here instead, and the
          // whole path is on the buttons for anyone who hovers.
          <span className="job-row__actions">
            <button
              className="button button--quiet button--small"
              type="button"
              title={job.outputPath}
              onClick={revealOutput}
            >
              <FolderOpen size={13} aria-hidden="true" /> {t("Show in folder")}
            </button>
            <button
              className="button button--quiet button--small"
              type="button"
              title={job.outputPath}
              onClick={() => void copyOutputPath()}
              aria-live="polite"
            >
              {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              {t(copied ? "Copied" : "Copy path")}
            </button>
          </span>
        )}
        {revealError && (
          <span className="job-row__message job-row__message--error" role="alert">
            {t(revealError)}
          </span>
        )}
      </div>
      <div className="job-row__status">
        <span className="job-row__status-label">
          {job.status === "succeeded" && <Check size={13} aria-hidden="true" />}
          {(job.status === "failed" || job.status === "interrupted") && (
            <AlertTriangle size={13} aria-hidden="true" />
          )}
          {(job.status === "cancelled" || job.status === "queued") && (
            <CircleSlash size={13} aria-hidden="true" />
          )}
          {t(statusLabels[job.status])}
          {job.status === "running" && percentage != null ? ` ${percentage}%` : ""}
        </span>
        {onCancel && (job.status === "running" || job.status === "queued") && (
          <button
            className="button button--quiet button--small"
            type="button"
            onClick={() => onCancel(job.id)}
          >
            <CircleSlash size={13} aria-hidden="true" /> {t("Stop")}
          </button>
        )}
        {job.status === "running" && (
          <div
            className={`progress-track${percentage == null ? " progress-track--indeterminate" : ""}`}
            role="progressbar"
            aria-label={t("Progress of {name}", { name: job.operationLabel })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage ?? undefined}
          >
            <span style={{ inlineSize: percentage == null ? undefined : `${percentage}%` }} />
          </div>
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
