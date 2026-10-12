import { readFile } from "node:fs/promises";

const manifestPath = new URL("../../tooling/tools.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const requiredCapabilities = [
  "media.transcode", "media.extract_audio", "media.compress", "media.trim", "media.inspect",
  "pdf.merge", "pdf.split", "pdf.rotate", "pdf.linearize", "pdf.encrypt",
  "image.resize", "image.crop", "image.convert", "image.compress", "image.upscale_lanczos",
  "download.inspect", "download.media", "download.javascript_runtime",
  "dev.json.format", "dev.json.query", "dev.yaml.format", "dev.yaml.query", "dev.search", "dev.files.find",
  "archive.compress", "archive.extract", "documents.convert",
  "metadata.read", "metadata.write",
  "pdf.extract_text", "pdf.rasterize",
  "image.optimize_png", "image.compress_gif", "image.convert_extended", "image.grayscale", "image.inspect",
  "media.remux", "media.inspect_matroska",
  "dev.tabular.convert", "dev.tabular.summary", "dev.bytes.preview",
  "dev.code.count", "dev.diff.structural", "dev.disk.usage",
];

const declaredCapabilities = new Set(manifest.tools.flatMap((tool) => tool.capabilities));
const missingCapabilities = requiredCapabilities.filter((capability) => !declaredCapabilities.has(capability));

if (missingCapabilities.length > 0) {
  console.error(`Missing capabilities: ${missingCapabilities.join(", ")}`);
  process.exit(1);
}

console.log(`Capability audit passed: ${requiredCapabilities.length} required capabilities are declared.`);
