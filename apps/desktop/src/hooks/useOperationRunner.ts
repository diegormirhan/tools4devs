import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useJobQueue, type StartJobInput } from "../domain/job-queue";

export type OperationRequest = {
  toolId: string;
  operationId: string;
  inputPaths: string[];
  outputPath: string | null;
  options: Record<string, string>;
  sourceUrl: string | null;
  /** What to do when the destination already exists. */
  conflictPolicy?: string;
};

type OperationResult = { stdout: string; outputPath?: string | null; message?: string };

type OperationProgressEvent = {
  jobId: string | null;
  toolId: string;
  operationId: string;
  phase: "starting" | "downloading" | "completed" | "error";
  progress: number | null;
  message: string;
};

const browserPreviewNotice =
  "Open the tools4devs app to run operations on Windows. This page is the interface preview only.";

/**
 * Runs operations against the native host and mirrors them in the session queue.
 * The progress listener lives here, not in the panel, so a job keeps reporting
 * after the user closes the tool it was started from.
 */
export function useOperationRunner({
  concurrency = 2,
  conflictPolicy = "keep-both",
}: { concurrency?: number; conflictPolicy?: string } = {}) {
  const queue = useJobQueue();
  const { reportProgress, beginJob, settleJob } = queue;

  /**
   * Work that is waiting for a slot.
   *
   * A ref rather than state: the scheduler reads and mutates it inside the
   * same tick it starts a job, and a re-render between those two would run
   * the same entry twice.
   */
  const waiting = useRef<{ jobId: string; request: OperationRequest }[]>([]);
  const active = useRef(0);

  useEffect(() => {
    if (!isNativeHost()) return;
    let active = true;
    let unlisten: (() => void) | undefined;

    void listen<OperationProgressEvent>("operation-progress", (event) => {
      const progress = event.payload;
      if (!active || !progress.jobId || progress.phase === "completed" || progress.phase === "error") return;
      reportProgress(progress.jobId, { progress: progress.progress, message: progress.message });
    })
      .then((cleanup) => {
        if (active) unlisten = cleanup;
        else cleanup();
      })
      .catch(() => {
        // The browser preview intentionally has no native event bridge.
      });

    return () => {
      active = false;
      unlisten?.();
    };
  }, [reportProgress]);

  const dispatch = useCallback(
    (jobId: string, request: OperationRequest) => {
      active.current += 1;
      beginJob(jobId);
      void executeOnHost({ ...request, conflictPolicy }, jobId)
        .then((result) => {
          const message = result.stdout.trim() || result.message || "Finished on the Windows host.";
          settleJob(jobId, { status: "succeeded", message, outputPath: result.outputPath ?? null });
        })
        .catch((error: unknown) => {
          const message = describeError(error);
          // The host says so in its own words; the queue reads it back as a
          // state rather than as one more red row.
          settleJob(jobId, {
            status: message.includes(cancelledMarker) ? "cancelled" : "failed",
            message: message.includes(cancelledMarker) ? "Stopped." : message,
          });
        })
        .finally(() => {
          active.current = Math.max(0, active.current - 1);
          const next = waiting.current.shift();
          if (next) dispatch(next.jobId, next.request);
        });
    },
    [beginJob, settleJob, conflictPolicy],
  );

  /**
   * Starts an operation, or queues it when the machine is already busy.
   *
   * The limit exists because four simultaneous transcodes are slower than four
   * consecutive ones and make the machine unusable meanwhile. Queued work is
   * visible as queued rather than silently delayed.
   */
  function runOperation(request: OperationRequest, meta: Omit<StartJobInput, "toolId" | "operationId">): string {
    const limit = Math.max(1, Math.round(concurrency));
    const hasRoom = active.current < limit;
    const jobId = queue.startJob(
      { toolId: request.toolId, operationId: request.operationId, ...meta },
      hasRoom ? "running" : "queued",
    );

    if (hasRoom) dispatch(jobId, request);
    else waiting.current.push({ jobId, request });

    return jobId;
  }

  /** Stops a job, whether it is running on the host or still waiting here. */
  function cancelOperation(jobId: string) {
    const index = waiting.current.findIndex((entry) => entry.jobId === jobId);
    if (index >= 0) {
      waiting.current.splice(index, 1);
      settleJob(jobId, { status: "cancelled", message: "Stopped before it started." });
      return;
    }
    if (!isNativeHost()) {
      settleJob(jobId, { status: "cancelled", message: "Stopped." });
      return;
    }
    // The host's own failure path settles the job; this only asks.
    void invoke<boolean>("cancel_operation", { jobId }).catch(() => {
      settleJob(jobId, { status: "failed", message: "That job could not be stopped." });
    });
  }

  return { ...queue, runOperation, cancelOperation };
}

/** The sentence the host fails a cancelled job with. Kept in step with running.rs. */
const cancelledMarker = "Stopped before it finished.";

async function executeOnHost(request: OperationRequest, jobId: string): Promise<OperationResult> {
  if (!isNativeHost()) throw new Error(browserPreviewNotice);
  return invoke<OperationResult>("execute_operation", { request: { ...request, jobId } });
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "The operation could not be run.";
}

export function isNativeHost(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
