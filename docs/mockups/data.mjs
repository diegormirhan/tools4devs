// Catalog subset used by the mockups (mirrors apps/desktop/src/catalog/catalog.ts).
/* ---------- Data (mirrors apps/desktop/src/catalog/catalog.ts) ---------- */
export const groups = [
  { id: "video", title: "Video and audio", icon: "clapperboard", tone: "clay", tools: [
    { id: "ffmpeg", title: "Convert media", icon: "clapperboard", engine: "FFMPEG", size: "84 MB", ops: 14,
      desc: "Convert, compress, resize, trim, and fourteen other jobs on video and audio." },
    { id: "ffprobe", title: "Inspect media", icon: "scan-search", engine: "FFPROBE", size: "84 MB", ops: 1,
      desc: "See codecs, tracks, dimensions and technical metadata." },
    { id: "songrec", title: "Name the music", icon: "music", engine: "SONGREC", size: "12 MB", ops: 2,
      desc: "Identify what is playing, from the speakers or the room." },
    { id: "mkvtoolnix", title: "Package Matroska", icon: "layers", engine: "MKVTOOLNIX", size: "31 MB", ops: 4,
      desc: "Merge, split and rebuild tracks inside MKV files." },
  ]},
  { id: "downloads", title: "Downloads", icon: "download", tone: "sage", tools: [
    { id: "yt-dlp", title: "Download media", icon: "download", engine: "YT-DLP", size: "18 MB", ops: 5,
      desc: "Save a video or just its audio from a link." },
    { id: "gallery-dl", title: "Download galleries", icon: "images", engine: "GALLERY-DL", size: "14 MB", ops: 2,
      desc: "Save whole image galleries in one go." },
  ]},
  { id: "images", title: "Images", icon: "image", tone: "ochre", tools: [
    { id: "libvips", title: "Adjust images", icon: "image" }, { id: "image-search", title: "Find where a picture came from", icon: "search" },
    { id: "imagemagick", title: "Image formats", icon: "wand-sparkles" }, { id: "oxipng", title: "Optimise PNG", icon: "minimize-2" },
    { id: "exiftool", title: "Metadata", icon: "tag" } ] },
  { id: "documents", title: "PDFs and documents", icon: "file-text", tone: "slate", tools: [
    { id: "qpdf", title: "Organise PDFs", icon: "file-text" }, { id: "poppler", title: "Extract from PDFs", icon: "file-output" },
    { id: "tesseract", title: "Read text from images", icon: "scan-text" }, { id: "pandoc", title: "Convert documents", icon: "file-type" } ] },
  { id: "data", title: "Text and data", icon: "braces", tone: "plum", tools: [
    { id: "jq", title: "Format JSON", icon: "braces" }, { id: "yq", title: "Work with YAML", icon: "file-json" },
    { id: "miller", title: "Spreadsheets and CSV", icon: "table" }, { id: "ripgrep", title: "Search a project", icon: "text-search" },
    { id: "fd", title: "Find files", icon: "folder-search" }, { id: "difftastic", title: "Compare files", icon: "git-compare" } ] },
  { id: "utilities", title: "Quick tools", icon: "sparkles", tone: "stone", tools: [
    { id: "text-tools", title: "Work on text", icon: "type" }, { id: "codes-hashes", title: "Codes and hashes", icon: "hash" },
    { id: "css-tools", title: "CSS generators", icon: "paintbrush" }, { id: "code-formatting", title: "Minify and format", icon: "code" },
    { id: "network", title: "Network lookups", icon: "globe" }, { id: "qr-barcode", title: "QR codes and barcodes", icon: "qr-code" } ] },
  { id: "calculators", title: "Calculators", icon: "calculator", tone: "rose", tools: [
    { id: "math-finance", title: "Math, finance and health", icon: "calculator" }, { id: "dates-time", title: "Dates and time", icon: "calendar" },
    { id: "everyday", title: "Everyday calculators", icon: "sparkles" }, { id: "random-picks", title: "Random picks", icon: "dices" },
    { id: "test-data", title: "Test data", icon: "flask-conical" }, { id: "colors", title: "Colour tools", icon: "palette" } ] },
  { id: "files", title: "Files and disk", icon: "archive", tone: "teal", tools: [
    { id: "7zip", title: "Compress files", icon: "archive" }, { id: "dust", title: "Disk usage", icon: "hard-drive" },
    { id: "tokei", title: "Count code", icon: "chart-column" }, { id: "hexyl", title: "View bytes", icon: "binary" } ] },
  { id: "mockups", title: "Mockups", icon: "layout-template", tone: "sand", tools: [
    { id: "chat-mockup", title: "Chat mockup", icon: "message-square" }, { id: "post-mockup", title: "Post mockup", icon: "layout-template" } ] },
];
export const counts = { video: 4, downloads: 2, images: 5, documents: 4, data: 6, utilities: 6, calculators: 6, files: 4, mockups: 2 };
export const ffmpegOps = ["Convert format", "Compress media", "Trim a section", "Resize video", "Crop video", "Rotate video",
  "Change speed", "Change frame rate", "Extract audio", "Remove audio", "Normalise loudness", "Make a GIF", "Grab a frame", "Contact sheet"];
export const activeOp = "Extract audio";

