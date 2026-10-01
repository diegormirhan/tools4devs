import { describe, expect, it } from "vitest";
import toolManifest from "../../../../tooling/tools.json";
import { downloadSize, formatBytes } from "./sizes";

describe("download sizes", () => {
  it("knows how large every component the app can fetch is", () => {
    // The promise is that nothing downloads without its size having been shown,
    // which only holds if every downloadable tool carries one.
    const missing = toolManifest.tools
      .filter((tool) => tool.status === "downloadable")
      .filter((tool) => downloadSize(tool.id) === null)
      .map((tool) => tool.id);

    expect(missing).toEqual([]);
  });

  it("adds up the artifacts a single tool is split across", () => {
    // FFmpeg and ffprobe come out of one archive, and each reports all of it.
    expect(downloadSize("ffmpeg")).toBe(downloadSize("ffprobe"));
    expect(downloadSize("ffmpeg")).toBeGreaterThan(100 * 1024 * 1024);
  });

  it("writes a size the way a person would say it", () => {
    expect(formatBytes(216_045_457)).toBe("206 MB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(1_500_000_000)).toBe("1.4 GB");
    expect(formatBytes(480 * 1024)).toBe("480 kB");
  });

  it("says nothing rather than zero when the size is not known", () => {
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(Number.NaN)).toBe("");
    expect(formatBytes(-1)).toBe("");
  });
});
