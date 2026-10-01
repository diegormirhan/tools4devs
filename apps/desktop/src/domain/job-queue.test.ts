import { describe, expect, it } from "vitest";
import { restoreJobs, RETAINED_JOBS, isFinished, type ToolJob } from "./job-queue";

function job(overrides: Partial<ToolJob> = {}): ToolJob {
  return {
    id: "ffmpeg-convert-1",
    toolId: "ffmpeg",
    toolName: "Convert media",
    operationId: "convert",
    operationLabel: "Convert",
    sourceLabel: "clip.mp4",
    status: "succeeded",
    progress: 1,
    message: "Done.",
    outputPath: "C:\\clips\\clip.mkv",
    options: {},
    startedAt: 0,
    ...overrides,
  };
}

describe("restoring the queue after a restart", () => {
  it("does not let a job claim to still be running", () => {
    // Its process died with the app. A row stuck at 40% forever would be a lie
    // the interface is telling about work nobody is doing.
    const stored = JSON.stringify([
      job({ status: "running", progress: 0.4 }),
      job({ id: "b", status: "queued" }),
    ]);
    const restored = restoreJobs(() => stored);

    expect(restored.map((entry) => entry.status)).toEqual(["interrupted", "interrupted"]);
    expect(restored[0]!.progress).toBeNull();
    expect(restored[0]!.message).toMatch(/closed before this finished/i);
    expect(restored.every(isFinished)).toBe(true);
  });

  it("survives a history that is missing, empty or nonsense", () => {
    expect(restoreJobs(() => null)).toEqual([]);
    expect(restoreJobs(() => "")).toEqual([]);
    expect(restoreJobs(() => "not json")).toEqual([]);
    expect(restoreJobs(() => '{"not":"an array"}')).toEqual([]);
    expect(restoreJobs(() => "[1, 2, null]")).toEqual([]);
    expect(
      restoreJobs(() => {
        throw new Error("storage is blocked");
      }),
    ).toEqual([]);
  });

  it("drops the oldest rather than growing without end", () => {
    const stored = JSON.stringify(
      Array.from({ length: RETAINED_JOBS + 40 }, (_, index) => job({ id: `job-${index}` })),
    );
    const restored = restoreJobs(() => stored);

    expect(restored).toHaveLength(RETAINED_JOBS);
    expect(restored[0]!.id).toBe("job-0");
  });
});
