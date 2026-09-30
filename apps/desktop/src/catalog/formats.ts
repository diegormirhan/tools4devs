/**
 * What each tool can take in, and what each operation can put out.
 *
 * Two questions were being answered by guesswork before this existed: whether a
 * file belongs in the tool it was dropped on — an image was happily accepted by
 * the PDF tool — and what a conversion is allowed to produce, which until now
 * was whatever extension the user happened to type into the save dialog.
 */

import { utilityGroupIds } from "../utilities/registry";

export type FormatFamily = "image" | "video" | "audio" | "pdf" | "document" | "archive" | "data" | "any";

/** Extensions per family, lowercase and without the dot. */
export const familyExtensions: Record<Exclude<FormatFamily, "any">, string[]> = {
  image: ["png", "jpg", "jpeg", "webp", "avif", "gif", "tif", "tiff", "bmp", "heic", "heif", "ico", "svg"],
  video: ["mp4", "mkv", "webm", "mov", "avi", "m4v", "wmv", "flv", "mpg", "mpeg", "ts", "3gp"],
  audio: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "oga", "opus", "wma", "aiff"],
  pdf: ["pdf"],
  document: ["md", "markdown", "html", "htm", "docx", "odt", "rtf", "txt", "epub", "tex", "rst"],
  archive: ["zip", "7z", "rar", "tar", "gz", "bz2", "xz"],
  data: ["json", "yaml", "yml", "csv", "tsv", "xml"],
};

/** Families each tool will accept as input. "any" means it does not care. */
export const toolAccepts: Record<string, FormatFamily[]> = {
  // The quick tools work on what you type, so a file dropped on the window has
  // nothing to do with them; "any" keeps them out of the drag-and-drop path
  // rather than letting them claim a file they cannot read.
  ...Object.fromEntries(utilityGroupIds.map((id) => [id, ["any"] as FormatFamily[]])),
  ffmpeg: ["video", "audio"],
  ffprobe: ["video", "audio"],
  mkvtoolnix: ["video"],
  libvips: ["image"],
  "image-search": ["image"],
  // No file at all: the chat mockup is built entirely from typed text.
  "chat-mockup": ["any"],
  "post-mockup": ["any"],
  // The recogniser is fed through FFmpeg, so anything with sound in it works.
  songrec: ["audio", "video"],
  imagemagick: ["image", "pdf"],
  oxipng: ["image"],
  exiftool: ["image", "video", "audio", "pdf", "document"],
  qpdf: ["pdf"],
  poppler: ["pdf"],
  tesseract: ["image", "pdf"],
  pandoc: ["document"],
  "7zip": ["any"],
  jq: ["data"],
  yq: ["data"],
  miller: ["data"],
  difftastic: ["any"],
  hexyl: ["any"],
  // Folder tools and URL tools take no file at all.
  ripgrep: ["any"],
  fd: ["any"],
  tokei: ["any"],
  dust: ["any"],
  "yt-dlp": ["any"],
  "gallery-dl": ["any"],
};

/**
 * Operations that read less than the card they sit on, listed by extension.
 *
 * A family is the right unit for a whole tool, but not for every operation on
 * it. The image card reads a dozen formats; the model that enlarges reads three
 * of them, and saying "image" would let a TIFF through to fail inside the
 * binary — which is the failure this table exists to prevent.
 */
export const operationExtensions: Record<string, string[]> = {
  "libvips/upscale-model": ["jpg", "jpeg", "png", "webp"],
};

/**
 * The formats an operation can write.
 *
 * Only conversions appear here: an operation that keeps the format, like
 * optimising a PNG, has nothing to choose.
 */
export const operationFormats: Record<string, { label: string; formats: string[]; default: string }> = {
  "ffmpeg/convert": {
    label: "Convert to",
    formats: ["mp4", "mkv", "webm", "mov", "avi"],
    default: "mp4",
  },
  "ffmpeg/extract-audio": {
    label: "Audio format",
    formats: ["mp3", "m4a", "wav", "flac", "opus", "ogg"],
    default: "mp3",
  },
  "ffmpeg/to-gif": { label: "Convert to", formats: ["gif", "webp"], default: "gif" },
  "ffmpeg/thumbnail": { label: "Image format", formats: ["png", "jpg", "webp"], default: "png" },
  "ffmpeg/contact-sheet": { label: "Image format", formats: ["png", "jpg", "webp"], default: "png" },
  "libvips/convert": {
    label: "Convert to",
    formats: ["png", "jpg", "webp", "tif", "gif", "avif"],
    default: "png",
  },
  "imagemagick/convert": {
    label: "Convert to",
    formats: ["png", "jpg", "webp", "tif", "bmp", "gif", "avif", "ico", "pdf"],
    default: "png",
  },
  "poppler/rasterize": { label: "Image format", formats: ["png", "jpg", "tif"], default: "png" },
  "libvips/upscale-model": { label: "Write as", formats: ["png", "jpg", "webp"], default: "png" },
  "pandoc/convert": {
    label: "Convert to",
    formats: ["html", "docx", "odt", "epub", "md", "rst", "tex", "txt"],
    default: "html",
  },
  "tesseract/ocr": { label: "Write as", formats: ["txt"], default: "txt" },
  "tesseract/ocr-pdf": { label: "Write as", formats: ["pdf"], default: "pdf" },
  "mkvtoolnix/remux": { label: "Convert to", formats: ["mkv"], default: "mkv" },
  "7zip/compress": { label: "Archive as", formats: ["zip", "7z"], default: "zip" },
};

export function extensionOf(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Whether a tool will take this file, and a sentence saying why not. */
export function acceptsFile(
  toolId: string,
  path: string,
  operationId?: string,
): { ok: true } | { ok: false; reason: string } {
  const extension = extensionOf(path);

  const explicit = operationId ? operationExtensions[`${toolId}/${operationId}`] : undefined;
  if (explicit) {
    if (explicit.includes(extension)) return { ok: true };
    const what = extension ? `A .${extension} file` : "That file";
    return {
      ok: false,
      reason: `${what} is not something this operation reads. It takes ${explicit
        .map((e) => `.${e}`)
        .join(", ")}.`,
    };
  }

  const families = toolAccepts[toolId] ?? ["any"];
  if (families.includes("any")) return { ok: true };

  const allowed = families.flatMap((family) =>
    family === "any" ? [] : familyExtensions[family],
  );
  if (allowed.includes(extension)) return { ok: true };

  const what = extension ? `A .${extension} file` : "That file";
  // Naming the families beats listing forty extensions the user has to scan.
  const expected = families.join(" or ");
  return { ok: false, reason: `${what} is not something this tool reads. It takes ${expected} files.` };
}

/**
 * The tools made for this file, for the suggestions after a drop. A tool that
 * takes anything is left out: listing the archiver for every file says nothing.
 */
export function suggestToolsFor(path: string): string[] {
  const extension = extensionOf(path);
  return Object.entries(toolAccepts)
    .filter(
      ([, families]) =>
        !families.includes("any") &&
        families.some((family) => family !== "any" && familyExtensions[family].includes(extension)),
    )
    .map(([toolId]) => toolId);
}
