import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCatalogRows, searchCatalog } from "./catalog";

describe("tool catalog", () => {
  it("does not present planned integrations as installed", () => {
    const rows = createCatalogRows();
    const tools = rows.flatMap((row) => row.tools);

    expect(tools.find((tool) => tool.id === "qpdf")?.availability).toBe("available");
    expect(tools.find((tool) => tool.id === "yt-dlp")?.availability).toBe("available");
  });

  it("finds tools by name, capability and file extension", () => {
    const rows = createCatalogRows();
    const toolIds = (query: string) => searchCatalog(rows, query).tools.map((match) => match.tool.id);

    expect(toolIds("youtube")).toEqual(["yt-dlp"]);
    expect(toolIds(".pdf")[0]).toBe("qpdf");
    // Cropping is no longer libvips alone: FFmpeg crops video now, so the
    // search has to surface both rather than pick a winner.
    expect(toolIds("crop")).toEqual(expect.arrayContaining(["ffmpeg", "libvips"]));
  });

  it("exposes concrete operations for each tool", () => {
    const tools = createCatalogRows().flatMap((row) => row.tools);
    expect(tools.find((tool) => tool.id === "ffmpeg")?.operations.map((operation) => operation.id)).toEqual([
      "convert", "compress", "trim", "resize", "crop", "rotate", "change-speed",
      "fps", "extract-audio", "remove-audio", "normalize-audio", "to-gif",
      "thumbnail", "contact-sheet",
    ]);
    expect(tools.find((tool) => tool.id === "yt-dlp")?.operations).toHaveLength(3);
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

  it("keeps enlarging on the image card rather than in a card of its own", () => {
    const rows = createCatalogRows();
    const tools = rows.flatMap((row) => row.tools);
    const images = tools.find((tool) => tool.id === "libvips");

    // Looking to make a picture bigger means looking at the image card, so
    // both ways of doing it live there.
    const operations = images?.operations.map((operation) => operation.id) ?? [];
    expect(operations).toContain("upscale");
    expect(operations).toContain("upscale-model");

    // And nothing else competes for the same intent: the component that does
    // the work has no card of its own.
    expect(tools.filter((tool) => tool.operations.some((o) => o.id.startsWith("upscale"))))
      .toHaveLength(1);
    expect(tools.find((tool) => tool.id === "waifu2x")).toBeUndefined();
  });

  it("marks the card the app provides itself as ready, with nothing to install", () => {
    const rows = createCatalogRows();
    const search = rows
      .flatMap((row) => row.tools)
      .find((tool) => tool.id === "image-search");

    // It has no manifest entry, because there is no binary behind it.
    expect(search).toBeDefined();
    expect(search?.availability).toBe("ready");
    expect(search?.delivery).toBe("embedded");
    expect(search?.integrationName).toBe("Reverse image search");
    expect(search?.downloadLabel).toBeUndefined();
  });

  it("carries the recogniser as an ordinary component that has to be fetched", () => {
    const rows = createCatalogRows();
    const songrec = rows.flatMap((row) => row.tools).find((tool) => tool.id === "songrec");

    expect(songrec?.status).toBe("downloadable");
    expect(songrec?.availability).toBe("available");
    expect(songrec?.capabilities).toContain("audio.recognize");
  });
});

describe("the command palette's search", () => {
  const rows = createCatalogRows();

  it("puts the action that does the job ahead of the tools that contain it", () => {
    const result = searchCatalog(rows, "extract au");

    expect(result.actions[0]).toMatchObject({ tool: { id: "ffmpeg" }, operation: { id: "extract-audio" }, row: { id: "video" } });
    expect(result.tools.every((match) => match.row.tools.includes(match.tool))).toBe(true);
  });

  it("matches words in any order, whatever the case and the accents", () => {
    const ids = (query: string) => searchCatalog(rows, query).actions.map((match) => `${match.tool.id}/${match.operation.id}`);

    expect(ids("AUDIO extract")).toContain("ffmpeg/extract-audio");
    expect(ids("extráct")).toContain("poppler/extract-text");
  });

  it("finds an action by the words on screen, in the language the person reads", () => {
    const portuguese: Record<string, string> = { "Extract audio": "Extrair áudio" };
    const translate = (text: string) => portuguese[text] ?? text;

    const actions = searchCatalog(rows, "extrair audio", translate).actions;
    // yt-dlp names its audio-only download "Extract audio" too; both are right.
    expect(actions.map((match) => `${match.tool.id}/${match.operation.id}`)).toEqual(["ffmpeg/extract-audio", "yt-dlp/download-audio"]);
  });

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

it('carries gallery-dl as an on-demand download under a copyleft licence', () => {
  const tool = createCatalogRows()
    .flatMap((row) => row.tools)
    .find((entry) => entry.id === 'gallery-dl');

  expect(tool).toBeDefined();
  // GPL-2.0 keeps it out of the installer; it is fetched on demand instead.
  expect(tool?.status).toBe('downloadable');
  expect(tool?.delivery).toBe('on-demand');
  expect(tool?.operations.map((operation) => operation.id)).toEqual([
    'download-gallery',
    'inspect-url',
  ]);
});
