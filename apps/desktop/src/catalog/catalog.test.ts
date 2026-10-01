import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCatalogRows, searchCatalog } from "./catalog";

describe("tool catalog", () => {
  it("finds tools by name, capability and file extension", () => {
    const rows = createCatalogRows();
    const toolIds = (query: string) => searchCatalog(rows, query).tools.map((match) => match.tool.id);

    expect(toolIds("youtube")).toEqual(["yt-dlp"]);
    expect(toolIds(".pdf")[0]).toBe("qpdf");
    // Cropping is no longer libvips alone: FFmpeg crops video now, so the
    // search has to surface both rather than pick a winner.
    expect(toolIds("crop")).toEqual(expect.arrayContaining(["ffmpeg", "libvips"]));
  });

  it("groups tools by outcome, and places every one of them exactly once", () => {
    const rows = createCatalogRows();

    // The twelve-tool "dev tools" rail was the row nobody could scan; it is
    // split by what the tools are for.
    expect(rows.find((row) => row.id === "data")?.tools.map((tool) => tool.id)).toEqual([
      "jq", "yq", "miller", "ripgrep", "fd", "difftastic",
    ]);
    expect(rows.find((row) => row.id === "files")?.tools.map((tool) => tool.id)).toEqual([
      "7zip", "dust", "tokei", "hexyl",
    ]);

    // A tool in two categories, or in none, is a navigation bug.
    const placed = rows.flatMap((row) => row.tools.map((tool) => tool.id));
    expect(new Set(placed).size).toBe(placed.length);
    expect(placed).toHaveLength(39);

    // No category should be big enough to need scrolling to take in.
    for (const row of rows) expect(row.tools.length).toBeLessThanOrEqual(6);
  });
});

describe("the command palette's search", () => {
  const rows = createCatalogRows();

  it("offers every tool, and no action, before anything is typed", () => {
    const result = searchCatalog(rows, "  ");

    expect(result.actions).toEqual([]);
    expect(result.tools).toHaveLength(39);
  });
});

describe("what the sidebar and the cards draw from", () => {
  const rows = createCatalogRows();
  const tools = rows.flatMap((row) => row.tools);

  it("gives every tool an icon of its own, so no two cards look alike", () => {
    for (const tool of tools) expect(tool.icon, tool.id).toBeTypeOf("object");
    expect(new Set(tools.map((tool) => tool.icon)).size).toBe(tools.length);
  });

  it("gives every group an icon for the collapsed sidebar and a hue of its own", () => {
    for (const row of rows) {
      expect(row.icon, row.id).toBeTypeOf("object");
      expect(row.hue, row.id).toBeGreaterThanOrEqual(0);
      expect(row.hue, row.id).toBeLessThan(360);
    }
    expect(new Set(rows.map((row) => row.hue)).size).toBe(rows.length);
  });

  it("addresses every sub-tool by its id within the tool, without ambiguity", () => {
    for (const tool of tools) {
      const ids = tool.operations.map((operation) => operation.id);
      expect(new Set(ids).size, tool.id).toBe(ids.length);
      expect(ids.length, tool.id).toBeGreaterThan(0);
    }
  });

  it("points every preview at a clip and a poster that ship with the app, within budget", () => {
    const publicDirectory = path.resolve(import.meta.dirname, "../../public");
    const previews = tools.flatMap((tool) => (tool.preview ? [[tool.id, tool.preview] as const] : []));
    expect(previews.length).toBeGreaterThan(0);

    for (const [id, preview] of previews) {
      const clip = path.join(publicDirectory, preview.src);
      expect(existsSync(clip), `${id}: ${preview.src}`).toBe(true);
      expect(existsSync(path.join(publicDirectory, preview.poster)), `${id}: ${preview.poster}`).toBe(true);
      expect(statSync(clip).size, `${id}: ${preview.src}`).toBeLessThan(200 * 1024);
    }
  });

  it("gives every card a clip to preview, so none falls back to a bare icon", () => {
    expect(tools.filter((tool) => !tool.preview).map((tool) => tool.id)).toEqual([]);
  });

  it("keeps all the clips together within the installer's budget", () => {
    const publicDirectory = path.resolve(import.meta.dirname, "../../public");
    const total = tools
      .flatMap((tool) => (tool.preview ? [tool.preview.src, tool.preview.poster] : []))
      .reduce((sum, file) => sum + statSync(path.join(publicDirectory, file)).size, 0);
    expect(total).toBeLessThan(4 * 1024 * 1024);
  });
});

it('finds the right downloader by the name of the site', () => {
  const rows = createCatalogRows();
  const idsFor = (query: string) => searchCatalog(rows, query).tools.map((match) => match.tool.id);

  // Nobody is going to read a list of 1800 supported sites, so the platform
  // names are search keywords instead.
  expect(idsFor('pixiv')).toContain('gallery-dl');
  expect(idsFor('deviantart')).toContain('gallery-dl');
  expect(idsFor('twitch')).toContain('yt-dlp');
  expect(idsFor('tiktok')).toContain('yt-dlp');
  // A site both tools cover should offer both.
  expect(idsFor('reddit')).toEqual(expect.arrayContaining(['yt-dlp', 'gallery-dl']));
});
