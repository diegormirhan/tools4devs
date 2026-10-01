import {
  Archive,
  Binary,
  Braces,
  Calculator,
  ChartColumn,
  Clapperboard,
  Download,
  FileJson,
  FileOutput,
  FileText,
  FileType,
  FolderSearch,
  GitCompare,
  HardDrive,
  Image,
  Images,
  Layers,
  LayoutTemplate,
  MessageSquare,
  Minimize2,
  Music,
  ScanSearch,
  ScanText,
  Search,
  Sparkles,
  Table,
  Tag,
  TextSearch,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import toolManifest from "../../../../tooling/tools.json";
import { utilityGroups } from "../utilities/registry";
import type { InstallationState } from "../../../../scripts/component-installation/installation-state.mjs";

export type ToolAccent = "action" | "cool" | "amber" | "neutral";

export type ToolOperation = { id: string; label: string; description: string };

export type CatalogTool = {
  id: string;
  integrationName: string;
  title: string;
  description: string;
  category: string;
  availability: InstallationState["availability"];
  delivery: "embedded" | "on-demand";
  status: "planned" | "bundled" | "downloadable";
  accent: ToolAccent;
  size: "standard" | "wide" | "compact";
  keywords: string[];
  capabilities: string[];
  operations: ToolOperation[];
  downloadLabel?: string;
  icon: LucideIcon;
  /** A muted loop shown on hover; paths are relative to the app's public folder. */
  preview?: ToolPreview;
};

export type ToolPreview = { src: string; poster: string };

export type CatalogRow = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** OKLCH hue that tints the group's icons and cards. */
  hue: number;
  tools: CatalogTool[];
};

type ToolPresentation = Omit<
  CatalogTool,
  "integrationName" | "delivery" | "status" | "availability" | "capabilities"
> & {
  /**
   * The app itself does this one, so there is no binary in the manifest to
   * look it up in. Reverse image search is the only such card: it is an upload
   * and a browser window, and nothing to install.
   */
  builtIn?: { integrationName: string; capabilities: string[] };
};

const utilityPresentations: Record<string, ToolPresentation> = Object.fromEntries(
  utilityGroups.map((group) => [
    group.id,
    {
      id: group.id,
      title: group.title,
      description: group.description,
      category: "utilities",
      accent: "action" as const,
      size: "standard" as const,
      operations: group.utilities.map((utility) => ({
        id: utility.id,
        label: utility.label,
        description: utility.description,
      })),
      keywords: group.keywords,
      icon: group.icon,
      preview: group.preview,
      builtIn: { integrationName: "Tools4Devs", capabilities: [] },
    },
  ]),
);

const presentationById: Record<string, ToolPresentation> = {
  ...utilityPresentations,
  qpdf: {
    id: "qpdf",
    icon: FileText,
    preview: { src: "/previews/qpdf.webm", poster: "/previews/qpdf.jpg" },
    title: "Organise PDFs",
    description: "Merge, split, rotate, protect and optimise documents.",
    category: "documents",
    accent: "amber",
    size: "wide",
    operations: [
      { id: "merge", label: "Merge PDFs", description: "Join several documents into one file." },
      { id: "split", label: "Split pages", description: "Pull pages out into new files." },
      { id: "rotate", label: "Rotate pages", description: "Fix the orientation of the document." },
      { id: "protect", label: "Protect document", description: "Add a password to the PDF." },
      { id: "linearize", label: "Optimise for web", description: "Prepare the PDF for progressive loading." },
    ],
    keywords: ["pdf", ".pdf", "merge", "split", "rotate", "document", "password"],
  },
  poppler: {
    id: "poppler",
    icon: FileOutput,
    preview: { src: "/previews/poppler.webm", poster: "/previews/poppler.jpg" },
    title: "Extract from PDFs",
    description: "Pull the text out of a document, or turn a page into an image.",
    category: "documents",
    accent: "amber",
    size: "standard",
    operations: [
      { id: "extract-text", label: "Extract text", description: "Save the PDF text with its layout preserved." },
      { id: "rasterize", label: "Page as image", description: "Render a chosen page to PNG." },
    ],
    keywords: ["pdf", ".pdf", "text", "rasterize", "page", "image", "document"],
    downloadLabel: "In-app download",
  },
  libvips: {
    id: "libvips",
    icon: Image,
    preview: { src: "/previews/libvips.webm", poster: "/previews/libvips.jpg" },
    title: "Adjust images",
    description: "Resize, crop, compress, convert — and enlarge with a model.",
    category: "images",
    accent: "cool",
    size: "wide",
    operations: [
      { id: "resize", label: "Resize", description: "Change width and height, keeping the aspect ratio." },
      { id: "crop", label: "Crop", description: "Pick an exact region of the image." },
      { id: "compress", label: "Compress image", description: "Trade quality for size, with the dial in view." },
      { id: "convert", label: "Convert format", description: "Export to the common image formats." },
      { id: "upscale", label: "Enlarge (plain)", description: "Lanczos resampling. Nothing invented, but soft." },
      {
        id: "upscale-model",
        label: "Enlarge (model)",
        description: "Two to four times over, with a model that rebuilds detail instead of blurring it.",
      },
    ],
    keywords: [
      "image", "photo", "resize", "crop", "compress", "convert", "upscale", "enlarge",
      "bigger", "sharpen", "super resolution", "nomos", "denoise", "ai", "model", "quality", "sharp",
    ],
    downloadLabel: "In-app download",
  },
  "image-search": {
    id: "image-search",
    icon: Search,
    preview: { src: "/previews/image-search.webm", poster: "/previews/image-search.jpg" },
    title: "Find where a picture came from",
    description: "Search the web by picture: the original, bigger copies, and pages using it.",
    category: "images",
    accent: "cool",
    size: "standard",
    operations: [
      { id: "search", label: "Search", description: "Open the results in your browser." },
    ],
    keywords: [
      "reverse", "image", "search", "lens", "yandex", "bing", "tineye", "source",
      "origin", "find", "similar", "where from", "photo",
    ],
    builtIn: { integrationName: "Reverse image search", capabilities: ["image.reverse_search"] },
  },
  "chat-mockup": {
    id: "chat-mockup",
    icon: MessageSquare,
    preview: { src: "/previews/chat-mockup.webm", poster: "/previews/chat-mockup.jpg" },
    title: "Chat mockup",
    description: "A made-up WhatsApp, iMessage or Instagram DM conversation, for a mockup or a test.",
    category: "utilities",
    accent: "action",
    size: "standard",
    operations: [
      { id: "build", label: "Build", description: "Type messages, then save the chat as a picture." },
    ],
    keywords: [
      "chat", "mockup", "fake", "whatsapp", "imessage", "instagram", "dm", "message",
      "conversation", "screenshot", "test", "design", "generator",
    ],
    builtIn: { integrationName: "Chat mockup", capabilities: [] },
  },
  "post-mockup": {
    id: "post-mockup",
    icon: LayoutTemplate,
    preview: { src: "/previews/post-mockup.webm", poster: "/previews/post-mockup.jpg" },
    title: "Post mockup",
    description: "A made-up tweet or Instagram post, for a mockup or a test.",
    category: "utilities",
    accent: "action",
    size: "standard",
    operations: [
      { id: "build", label: "Build", description: "Type the post, then save it as a picture." },
    ],
    keywords: [
      "post", "mockup", "fake", "tweet", "twitter", "x", "instagram", "social",
      "screenshot", "test", "design", "generator",
    ],
    builtIn: { integrationName: "Post mockup", capabilities: [] },
  },
  imagemagick: {
    id: "imagemagick",
    icon: WandSparkles,
    preview: { src: "/previews/imagemagick.webm", poster: "/previews/imagemagick.jpg" },
    title: "Image formats",
    description: "Convert between formats the other tools do not reach, and inspect the details.",
    category: "images",
    accent: "cool",
    size: "standard",
    operations: [
      { id: "convert", label: "Convert format", description: "The destination extension decides the output format." },
      { id: "grayscale", label: "Convert to grey", description: "Drop the colour, keep the luminance." },
      { id: "inspect", label: "Inspect image", description: "Format, dimensions, profile and channels." },
    ],
    keywords: ["image", "convert", "format", "tiff", "heic", "psd", "grey", "inspect"],
    downloadLabel: "In-app download",
  },
  oxipng: {
    id: "oxipng",
    icon: Minimize2,
    preview: { src: "/previews/oxipng.webm", poster: "/previews/oxipng.jpg" },
    title: "Optimise PNG",
    description: "Make PNGs smaller without losing a pixel.",
    category: "images",
    accent: "neutral",
    size: "compact",
    operations: [
      { id: "optimize", label: "Lossless optimise", description: "Recompress the PNG, pixel for pixel identical." },
    ],
    keywords: ["png", "optimise", "optimize", "compress", "image", "lossless"],
  },
  exiftool: {
    id: "exiftool",
    icon: Tag,
    preview: { src: "/previews/exiftool.webm", poster: "/previews/exiftool.jpg" },
    title: "Metadata",
    description: "Read, strip or edit the metadata in photos, video and documents.",
    category: "files",
    accent: "amber",
    size: "standard",
    operations: [
      { id: "inspect", label: "Read metadata", description: "List every tag found in the file." },
      { id: "strip", label: "Remove metadata", description: "Write a copy with no EXIF, GPS or other tags." },
      { id: "set-title", label: "Set title", description: "Write a title into a new copy of the file." },
    ],
    keywords: ["metadata", "exif", "gps", "title", "photo", "strip", "privacy"],
    downloadLabel: "In-app download",
  },
  "yt-dlp": {
    id: "yt-dlp",
    icon: Download,
    preview: { src: "/previews/yt-dlp.webm", poster: "/previews/yt-dlp.jpg" },
    title: "Download media",
    description: "Save video or audio from a supported URL.",
    category: "downloads",
    accent: "action",
    size: "wide",
    operations: [
      { id: "download-video", label: "Download video", description: "Take the best quality available." },
      { id: "download-audio", label: "Extract audio", description: "Keep the audio track only." },
      { id: "inspect-url", label: "Inspect URL", description: "See the formats before downloading." },
    ],
    keywords: [
      "url", "download", "video", "audio", "media",
      "youtube", "twitch", "vimeo", "tiktok", "soundcloud", "twitter", "x",
      "facebook", "instagram", "dailymotion", "bilibili", "reddit", "bandcamp",
    ],
    downloadLabel: "With dependencies",
  },
  "gallery-dl": {
    id: "gallery-dl",
    icon: Images,
    preview: { src: "/previews/gallery-dl.webm", poster: "/previews/gallery-dl.jpg" },
    title: "Download galleries",
    description: "Save images and albums from a post, profile or gallery URL.",
    category: "downloads",
    accent: "amber",
    size: "standard",
    operations: [
      { id: "download-gallery", label: "Download gallery", description: "Save every image the URL holds into a folder." },
      { id: "inspect-url", label: "Inspect URL", description: "List what is there before downloading." },
    ],
    keywords: [
      "gallery", "images", "album", "download", "url", "posts",
      // Platform names so a search for the site finds the tool that handles it.
      "instagram", "pixiv", "deviantart", "twitter", "x", "reddit", "tumblr",
      "flickr", "artstation", "imgur", "mastodon", "bluesky", "danbooru",
    ],
    downloadLabel: "In-app download",
  },
  ffmpeg: {
    id: "ffmpeg",
    icon: Clapperboard,
    preview: { src: "/previews/ffmpeg.webm", poster: "/previews/ffmpeg.jpg" },
    title: "Convert media",
    description: "Convert, compress, resize, trim, and fourteen other jobs on video and audio.",
    category: "downloads",
    accent: "cool",
    size: "standard",
    operations: [
      { id: "convert", label: "Convert format", description: "Re-encode into another container." },
      { id: "compress", label: "Compress media", description: "Shrink it, choosing compatibility or size." },
      { id: "trim", label: "Trim a section", description: "Set start and end, avoiding a re-encode where possible." },
      { id: "resize", label: "Resize video", description: "Scale to a width, keeping the aspect ratio." },
      { id: "crop", label: "Crop video", description: "Keep a rectangle of the frame." },
      { id: "rotate", label: "Rotate video", description: "Turn by a quarter, half or three quarters." },
      { id: "change-speed", label: "Change speed", description: "Speed up or slow down, audio included." },
      { id: "fps", label: "Change frame rate", description: "Re-time to a different frame rate." },
      { id: "extract-audio", label: "Extract audio", description: "Write an audio file from the video." },
      { id: "remove-audio", label: "Remove audio", description: "Drop the sound without touching the picture." },
      { id: "normalize-audio", label: "Normalise loudness", description: "Even out the volume to broadcast levels." },
      { id: "to-gif", label: "Make a GIF", description: "Animated GIF with a palette built from the clip." },
      { id: "thumbnail", label: "Grab a frame", description: "Save a single frame as an image." },
      { id: "contact-sheet", label: "Contact sheet", description: "A grid of frames in one image." },
    ],
    keywords: [
      "video", "audio", "convert", "compress", "trim", "transcode", "resize",
      "crop", "rotate", "speed", "fps", "gif", "thumbnail", "frame", "mute",
      "loudness", "normalise", "normalize", "mp4", "mkv", "webm", "mp3",
    ],
    downloadLabel: "In-app download",
  },
  songrec: {
    id: "songrec",
    icon: Music,
    preview: { src: "/previews/songrec.webm", poster: "/previews/songrec.jpg" },
    title: "Name the music",
    description: "Identify what is playing, from the speakers or the room.",
    category: "video",
    accent: "action",
    size: "standard",
    operations: [
      { id: "identify", label: "Identify", description: "Listen for a moment and name the track." },
    ],
    keywords: [
      "music", "song", "identify", "recognise", "recognize", "shazam", "track",
      "artist", "audio", "listen", "microphone", "what is playing", "name that tune",
    ],
    downloadLabel: "In-app download",
  },
  mkvtoolnix: {
    id: "mkvtoolnix",
    icon: Layers,
    preview: { src: "/previews/mkvtoolnix.webm", poster: "/previews/mkvtoolnix.jpg" },
    title: "Package Matroska",
    description: "Convert to MKV and inspect tracks without re-encoding.",
    category: "downloads",
    accent: "cool",
    size: "standard",
    operations: [
      { id: "remux", label: "Convert to MKV", description: "Swap the container, keep the original tracks." },
      { id: "inspect", label: "Inspect tracks", description: "List tracks, languages and codecs as JSON." },
    ],
    keywords: ["mkv", "matroska", "remux", "track", "subtitle", "container"],
    downloadLabel: "In-app download",
  },
  ffprobe: {
    id: "ffprobe",
    icon: ScanSearch,
    preview: { src: "/previews/ffprobe.webm", poster: "/previews/ffprobe.jpg" },
    title: "Inspect media",
    description: "See codecs, tracks, dimensions and technical metadata.",
    category: "downloads",
    accent: "neutral",
    size: "compact",
    operations: [{ id: "inspect", label: "Inspect file", description: "Read codecs, tracks and technical metadata." }],
    keywords: ["codec", "metadata", "inspect", "video", "audio"],
    downloadLabel: "In-app download",
  },
  jq: {
    id: "jq",
    icon: Braces,
    preview: { src: "/previews/jq.webm", poster: "/previews/jq.jpg" },
    title: "Format JSON",
    description: "Query, filter and format JSON without opening an editor.",
    category: "developer",
    accent: "cool",
    size: "standard",
    operations: [
      { id: "format", label: "Format JSON", description: "Indent and validate a JSON file." },
      { id: "query", label: "Query JSON", description: "Pull fields out with a jq expression." },
    ],
    keywords: ["json", "format", "query", "filter"],
  },
  yq: {
    id: "yq",
    icon: FileJson,
    preview: { src: "/previews/yq.webm", poster: "/previews/yq.jpg" },
    title: "Work with YAML",
    description: "Format, query and convert YAML and JSON.",
    category: "developer",
    accent: "amber",
    size: "standard",
    operations: [
      { id: "format", label: "Format YAML", description: "Indent and normalise a YAML file." },
      { id: "query", label: "Query YAML", description: "Pull fields out with a yq expression." },
    ],
    keywords: ["yaml", "yml", "json", "format", "query"],
  },
  miller: {
    id: "miller",
    icon: Table,
    preview: { src: "/previews/miller.webm", poster: "/previews/miller.jpg" },
    title: "Spreadsheets and CSV",
    description: "Convert between CSV, TSV and JSON, and summarise the columns.",
    category: "developer",
    accent: "amber",
    size: "wide",
    operations: [
      { id: "to-json", label: "CSV to JSON", description: "Read a CSV and see the records as JSON." },
      { id: "to-csv", label: "JSON to CSV", description: "Flatten a JSON of records into columns." },
      { id: "summary", label: "Summarise columns", description: "Type, count, nulls, minimum and maximum per column." },
    ],
    keywords: ["csv", "tsv", "json", "spreadsheet", "table", "column", "data"],
  },
  difftastic: {
    id: "difftastic",
    icon: GitCompare,
    preview: { src: "/previews/difftastic.webm", poster: "/previews/difftastic.jpg" },
    title: "Compare files",
    description: "A structural diff: it compares the syntax, not just the lines.",
    category: "developer",
    accent: "action",
    size: "standard",
    operations: [
      { id: "compare", label: "Compare two files", description: "Pick two files and see what actually changed." },
    ],
    keywords: ["diff", "compare", "difference", "syntax", "code", "merge"],
    downloadLabel: "In-app download",
  },
  ripgrep: {
    id: "ripgrep",
    icon: TextSearch,
    preview: { src: "/previews/ripgrep.webm", poster: "/previews/ripgrep.jpg" },
    title: "Search a project",
    description: "Find text and patterns across folders, fast.",
    category: "developer",
    accent: "action",
    size: "wide",
    operations: [
      { id: "search", label: "Search text", description: "Match patterns, skipping the folders that never matter." },
    ],
    keywords: ["grep", "search", "text", "regex", "code"],
  },
  fd: {
    id: "fd",
    icon: FolderSearch,
    preview: { src: "/previews/fd.webm", poster: "/previews/fd.jpg" },
    title: "Find files",
    description: "Locate files by name, extension or path.",
    category: "developer",
    accent: "neutral",
    size: "compact",
    operations: [{ id: "find", label: "Find files", description: "Filter paths without writing a command." }],
    keywords: ["find", "file", "folder", "search", "path"],
  },
  tokei: {
    id: "tokei",
    icon: ChartColumn,
    preview: { src: "/previews/tokei.webm", poster: "/previews/tokei.jpg" },
    title: "Count code",
    description: "See lines, comments and files per language in a project.",
    category: "developer",
    accent: "cool",
    size: "standard",
    operations: [
      { id: "count", label: "Count by language", description: "Total files, code, comments and blank lines." },
    ],
    keywords: ["lines", "code", "statistics", "language", "project", "loc"],
  },
  hexyl: {
    id: "hexyl",
    icon: Binary,
    preview: { src: "/previews/hexyl.webm", poster: "/previews/hexyl.jpg" },
    title: "View bytes",
    description: "Inspect the start of a file in hexadecimal.",
    category: "developer",
    accent: "neutral",
    size: "compact",
    operations: [{ id: "preview", label: "Hex preview", description: "Show the first bytes beside their ASCII." }],
    keywords: ["hex", "hexadecimal", "bytes", "binary", "signature", "magic"],
  },
  dust: {
    id: "dust",
    icon: HardDrive,
    preview: { src: "/previews/dust.webm", poster: "/previews/dust.jpg" },
    title: "Disk usage",
    description: "Find out which folders are taking the space.",
    category: "files",
    accent: "amber",
    size: "standard",
    operations: [{ id: "usage", label: "Largest folders", description: "List what weighs most inside a folder." }],
    keywords: ["disk", "space", "size", "folder", "cleanup", "du"],
  },
  "7zip": {
    id: "7zip",
    icon: Archive,
    preview: { src: "/previews/7zip.webm", poster: "/previews/7zip.jpg" },
    title: "Compress files",
    description: "Create and extract 7z, zip, tar, gzip, bzip2 and xz archives.",
    category: "files",
    accent: "amber",
    size: "standard",
    operations: [
      { id: "compress", label: "Compress", description: "Create an archive." },
      { id: "extract", label: "Extract", description: "Unpack the contents into a folder." },
    ],
    keywords: ["zip", "7z", "tar", "gzip", "bzip2", "xz", "compress", "extract", "archive"],
  },
  tesseract: {
    id: "tesseract",
    icon: ScanText,
    preview: { src: "/previews/tesseract.webm", poster: "/previews/tesseract.jpg" },
    title: "Read text from images",
    description: "Pull the words out of a scan or a photograph.",
    category: "documents",
    accent: "amber",
    size: "standard",
    operations: [
      { id: "ocr", label: "Extract text", description: "Write what it reads into a text file." },
      { id: "ocr-pdf", label: "Searchable PDF", description: "Keep the picture, add a text layer you can search." },
    ],
    keywords: ["ocr", "text", "scan", "recognise", "recognize", "read", "image", "pdf", "handwriting"],
    downloadLabel: "In-app download",
  },
  pandoc: {
    id: "pandoc",
    icon: FileType,
    preview: { src: "/previews/pandoc.webm", poster: "/previews/pandoc.jpg" },
    title: "Convert documents",
    description: "Convert Markdown and documents between open formats.",
    category: "documents",
    accent: "cool",
    size: "wide",
    operations: [{ id: "convert", label: "Convert document", description: "Choose the input and output formats." }],
    keywords: ["markdown", "docx", "html", "epub", "document"],
    downloadLabel: "In-app download",
  },
};

/// Six outcome-shaped groups rather than three broad ones. Three rails meant a
/// twelve-tool row nobody could scan; naming what you are trying to end up with
/// — a video, a PDF, a smaller image — is how people actually look for a tool.
const rowDefinitions = [
  {
    id: "video",
    icon: Clapperboard,
    hue: 255,
    title: "Video and audio",
    description: "Convert, compress, trim, inspect — and name what is playing.",
    toolIds: ["ffmpeg", "ffprobe", "songrec", "mkvtoolnix"],
  },
  {
    id: "downloads",
    icon: Download,
    hue: 165,
    title: "Downloads",
    description: "Save video, audio and image galleries from a link.",
    toolIds: ["yt-dlp", "gallery-dl"],
  },
  {
    id: "images",
    icon: Image,
    hue: 78,
    title: "Images",
    description: "Resize, crop, convert, shrink, and read or strip metadata.",
    toolIds: ["libvips", "image-search", "imagemagick", "oxipng", "exiftool"],
  },
  {
    id: "documents",
    icon: FileText,
    hue: 285,
    title: "PDFs and documents",
    description: "Reorganise pages, pull out text, and move between formats.",
    toolIds: ["qpdf", "poppler", "tesseract", "pandoc"],
  },
  {
    id: "data",
    icon: Braces,
    hue: 322,
    title: "Text and data",
    description: "Query, reshape, search and compare structured text.",
    toolIds: ["jq", "yq", "miller", "ripgrep", "fd", "difftastic"],
  },
  {
    id: "utilities",
    icon: Sparkles,
    hue: 215,
    title: "Quick tools",
    description: "Text, codes and test data — done here, with nothing to install.",
    toolIds: ["text-tools", "codes-hashes", "test-data", "css-tools", "code-formatting", "qr-barcode"],
  },
  {
    id: "calculators",
    icon: Calculator,
    hue: 12,
    title: "Calculators",
    description: "Dates, money, health and colour — worked out on the spot.",
    toolIds: ["dates-time", "math-finance", "colors", "everyday", "network", "random-picks"],
  },
  {
    id: "files",
    icon: Archive,
    hue: 195,
    title: "Files and disk",
    description: "Archives, byte-level inspection, and where the space went.",
    toolIds: ["7zip", "dust", "tokei", "hexyl"],
  },
  {
    id: "mockups",
    icon: LayoutTemplate,
    hue: 135,
    title: "Mockups",
    description: "Made up on purpose — for a design or a test, never a real account.",
    toolIds: ["chat-mockup", "post-mockup"],
  },
] as const;

export function createCatalogRows(): CatalogRow[] {
  const manifestTools = new Map(toolManifest.tools.map((tool) => [tool.id, tool]));

  return rowDefinitions.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    hue: row.hue,
    tools: row.toolIds.map((toolId) => {
      const manifestTool = manifestTools.get(toolId);
      const presentation = presentationById[toolId];

      if (!presentation) {
        throw new Error(`Missing catalog presentation for ${toolId}`);
      }

      if (presentation.builtIn) {
        const { builtIn, ...rest } = presentation;
        return {
          ...rest,
          integrationName: builtIn.integrationName,
          delivery: "embedded" as const,
          status: "bundled" as const,
          // Nothing to fetch, so it is ready the moment the app opens.
          availability: "ready" as const,
          capabilities: builtIn.capabilities,
        };
      }

      if (!manifestTool) {
        throw new Error(`Missing catalog presentation for ${toolId}`);
      }

      return {
        ...presentation,
        integrationName: manifestTool.displayName,
        delivery: requireDelivery(manifestTool.delivery),
        status: requireStatus(manifestTool.status),
        availability: manifestTool.status === "bundled" ? "ready" : "available",
        capabilities: manifestTool.capabilities,
        operations: presentation.operations,
      };
    }),
  }));
}

function requireStatus(value: string): CatalogTool["status"] {
  if (value === "planned" || value === "bundled" || value === "downloadable") return value;
  throw new Error(`Unsupported tool status: ${value}`);
}

function requireDelivery(value: string): CatalogTool["delivery"] {
  if (value === "embedded" || value === "on-demand") return value;
  throw new Error(`Unsupported delivery strategy: ${value}`);
}

export type ActionMatch = { row: CatalogRow; tool: CatalogTool; operation: ToolOperation };
export type ToolMatch = { row: CatalogRow; tool: CatalogTool };

/**
 * What the command palette lists for a query: actions (a tool's operation or
 * utility) and whole tools. Every word has to appear, in any order, in the
 * English source or in the text the person actually reads.
 */
export function searchCatalog(
  rows: CatalogRow[],
  rawQuery: string,
  translate: (text: string) => string = (text) => text,
): { actions: ActionMatch[]; tools: ToolMatch[] } {
  const words = normalizeSearch(rawQuery).split(/\s+/).filter(Boolean);
  const pairs = rows.flatMap((row) => row.tools.map((tool) => ({ row, tool })));
  if (words.length === 0) return { actions: [], tools: pairs };

  const matches = (...texts: string[]) => {
    const haystack = normalizeSearch(texts.flatMap((text) => [text, translate(text)]).join(" "));
    return words.every((word) => haystack.includes(word));
  };

  const actions = pairs
    .flatMap(({ row, tool }) => tool.operations.map((operation) => ({ row, tool, operation })))
    .filter(({ operation }) => matches(operation.label, operation.description));
  // An action whose name says it outranks one that only mentions it.
  const named = actions.filter(({ operation }) => matches(operation.label));

  return {
    actions: [...named, ...actions.filter((action) => !named.includes(action))],
    tools: pairs.filter(({ tool }) =>
      matches(tool.integrationName, tool.title, tool.description, ...tool.keywords, ...tool.capabilities),
    ),
  };
}

/** Accents are stripped so a search still matches whatever the user's keyboard produces. */
function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
