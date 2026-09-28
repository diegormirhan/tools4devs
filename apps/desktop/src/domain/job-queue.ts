import { useCallback, useEffect, useMemo, useState } from "react";

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  /** Somebody pressed stop. */
  | "cancelled"
  /** The app closed while it was running, so nobody knows how it ended. */
  | "interrupted";

export type ToolJob = {
  id: string;
  toolId: string;
  toolName: string;
  operationId: string;
  operationLabel: string;
  sourceLabel: string;
  status: JobStatus;
  /** `null` means the tool reports no measurable percentage; the UI must not invent one. */
  progress: number | null;
  message: string;
  outputPath: string | null;
  options: Record<string, string>;
  startedAt: number;
};

export type StartJobInput = Pick<
  ToolJob,
  "toolId" | "toolName" | "operationId" | "operationLabel" | "sourceLabel" | "options"
>;

export type JobProgressUpdate = { progress: number | null; message: string };

export type JobOutcome = {
  status: Exclude<JobStatus, "running" | "queued">;
  message: string;
  outputPath?: string | null;
};

/** A job is over once it is no longer waiting for or occupying the host. */
export function isFinished(job: ToolJob): boolean {
  return job.status !== "running" && job.status !== "queued";
}

const STORAGE_KEY = "tools4devs.jobs";

/**
 * How much history is kept.
 *
 * Metadata only — a name, a status, a path — so a thousand rows would still be
 * small. The cap is about the history staying readable, not about bytes.
 */
export const RETAINED_JOBS = 200;

/**
 * Reads back the queue from the last time the app ran.
 *
 * Anything that was still going is marked interrupted rather than left looking
 * like it is running: the process it belonged to died with the app, and a row
 * that claims to be at 40% forever is a lie the interface would be telling.
 */
export function restoreJobs(read: () => string | null): ToolJob[] {
  let parsed: unknown;
  try {
    const raw = read();
    if (!raw) return [];
    parsed = JSON.parse(raw);
  } catch {
    // Unreadable history is not worth a broken window.
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((entry): entry is ToolJob => {
      const job = entry as Partial<ToolJob>;
      return typeof job?.id === "string" && typeof job?.toolId === "string" && typeof job?.status === "string";
    })
    .slice(0, RETAINED_JOBS)
    .map((job) =>
      job.status === "running" || job.status === "queued"
        ? {
            ...job,
            status: "interrupted" as const,
            progress: null,
            message: "The app closed before this finished.",
          }
        : job,
    );
}

function persist(jobs: ToolJob[], write: (value: string) => void) {
  try {
    write(JSON.stringify(jobs.slice(0, RETAINED_JOBS)));
  } catch {
    // A full or blocked store must never break the queue itself.
  }
}

let jobSequence = 0;

/**
 * Owns every operation the session started, independent of which panel is open.
 * Closing a tool panel must never lose a job that the host is still running,
 * and neither must closing the app.
 */
export function useJobQueue() {
  const [jobs, setJobs] = useState<ToolJob[]>(() =>
    typeof localStorage === "undefined" ? [] : restoreJobs(() => localStorage.getItem(STORAGE_KEY)),
  );

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    persist(jobs, (value) => localStorage.setItem(STORAGE_KEY, value));
  }, [jobs]);

  const startJob = useCallback((input: StartJobInput, status: "queued" | "running" = "running"): string => {
    jobSequence += 1;
    // The clock is in the id so a restored history can never collide with a
    // job this session starts.
    const id = `${input.toolId}-${input.operationId}-${Date.now().toString(36)}-${jobSequence}`;
    setJobs((current) =>
      [
        {
          ...input,
          id,
          status,
          // Null, not zero: until the tool reports a percentage there is none to show.
          progress: null,
          message: status === "queued" ? "Waiting for a free slot…" : "Preparing the operation…",
          outputPath: null,
          startedAt: Date.now(),
        },
        ...current,
      ].slice(0, RETAINED_JOBS),
    );
    return id;
  }, []);

  const beginJob = useCallback((jobId: string) => {
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId && job.status === "queued"
          ? { ...job, status: "running", message: "Preparing the operation…", startedAt: Date.now() }
          : job,
      ),
    );
  }, []);

  const reportProgress = useCallback((jobId: string, update: JobProgressUpdate) => {
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId && job.status === "running"
          ? { ...job, progress: update.progress, message: update.message || job.message }
          : job,
      ),
    );
  }, []);

  const settleJob = useCallback((jobId: string, outcome: JobOutcome) => {
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: outcome.status,
              progress: outcome.status === "succeeded" ? 1 : job.progress,
              message: outcome.message,
              outputPath: outcome.outputPath ?? job.outputPath,
            }
          : job,
      ),
    );
  }, []);

  /** Drops finished entries only: a running job has nothing to clear yet. */
  const clearFinishedJobs = useCallback(() => {
    setJobs((current) => current.filter((job) => !isFinished(job)));
  }, []);

  const runningJobs = useMemo(() => jobs.filter((job) => !isFinished(job)), [jobs]);
  const finishedJobs = useMemo(() => jobs.filter(isFinished), [jobs]);

  return {
    jobs,
    runningJobs,
    finishedJobs,
    startJob,
    beginJob,
    reportProgress,
    settleJob,
    clearFinishedJobs,
    /** The older name for the same thing, kept because the settings view uses it. */
    clearHistory: clearFinishedJobs,
  };
}

export function findJob(jobs: ToolJob[], jobId: string | null): ToolJob | undefined {
  return jobId ? jobs.find((job) => job.id === jobId) : undefined;
}
