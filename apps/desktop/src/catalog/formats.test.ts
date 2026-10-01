import { describe, expect, it } from "vitest";
import { acceptsFile, operationFormats, suggestToolsFor, toolAccepts } from "./formats";
import { createCatalogRows } from "./catalog";

describe("file types", () => {
  it("keeps a file out of a tool that cannot read it", () => {
    // The reported case: the PDF tool took an image without complaint and
    // failed later, in the host, with a message about the file being invalid.
    const verdict = acceptsFile("qpdf", "C:/fotos/foto.png");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/\.png file is not something this tool reads/i);

    expect(acceptsFile("qpdf", "C:/docs/contrato.pdf").ok).toBe(true);
  });

  it("lets a tool that reads several families take any of them", () => {
    // ExifTool reads metadata out of pictures, video and documents alike.
    for (const path of ["a.jpg", "b.mp4", "c.pdf", "d.docx"]) {
      expect(acceptsFile("exiftool", path).ok).toBe(true);
    }
    expect(acceptsFile("exiftool", "e.zip").ok).toBe(false);
  });

  it("does not block tools that legitimately take anything", () => {
    // An archiver, a hex viewer and a differ have no business judging types.
    for (const toolId of ["7zip", "hexyl", "difftastic"]) {
      expect(acceptsFile(toolId, "whatever.bin").ok).toBe(true);
    }
  });

  it("suggests the tools made for a dropped file, and not the ones that take anything", () => {
    const video = suggestToolsFor("C:/clips/Holiday.MP4");
    expect(video).toEqual(expect.arrayContaining(["ffmpeg", "ffprobe", "mkvtoolnix", "songrec", "exiftool"]));
    // A hex viewer or an archiver reads it too, but naming them for every file tells nobody anything.
    expect(video).not.toContain("7zip");
    expect(video).not.toContain("hexyl");
    expect(video).not.toContain("qpdf");

    expect(suggestToolsFor("contrato.pdf")).toEqual(expect.arrayContaining(["qpdf", "poppler", "tesseract"]));
    expect(suggestToolsFor("notes.xyz")).toEqual([]);
  });

  it("is case-insensitive about the extension", () => {
    expect(acceptsFile("libvips", "C:/fotos/FOTO.JPG").ok).toBe(true);
  });

  it("declares an accepted family for every tool in the catalog", () => {
    // A tool missing from the table silently accepts everything, which is the
    // bug this table exists to prevent.
    const ids = createCatalogRows().flatMap((row) => row.tools.map((tool) => tool.id));
    for (const id of ids) expect(toolAccepts[id], id).toBeDefined();
  });

  it("offers only formats the operation can actually write", () => {
    // WebM cannot hold H.264, and the host switches codec for it; the list
    // must not offer a container the operation has no path to.
    expect(operationFormats["ffmpeg/convert"]?.formats).toContain("webm");
    expect(operationFormats["ffmpeg/extract-audio"]?.formats).not.toContain("mp4");
    for (const entry of Object.values(operationFormats)) {
      expect(entry.formats).toContain(entry.default);
    }
  });
});

describe("operations that read less than the card they sit on", () => {
  it("keeps a TIFF out of the model that enlarges, which reads three formats", () => {
    // The image card reads a dozen formats. The model reads three, and letting
    // a TIFF through would fail inside the binary instead of here.
    expect(acceptsFile("libvips", "foto.png", "upscale-model").ok).toBe(true);
    expect(acceptsFile("libvips", "foto.JPG", "upscale-model").ok).toBe(true);
    expect(acceptsFile("libvips", "foto.webp", "upscale-model").ok).toBe(true);

    const verdict = acceptsFile("libvips", "scan.tiff", "upscale-model");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/\.jpg, \.jpeg, \.png, \.webp/);

    // Every other operation on the same card still reads the whole family.
    expect(acceptsFile("libvips", "scan.tiff", "resize").ok).toBe(true);
    expect(acceptsFile("libvips", "scan.tiff").ok).toBe(true);
  });
});
