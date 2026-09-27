import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const sharp = createRequire(import.meta.url)("C:/Users/mirha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");
const output = new URL("./", import.meta.url);
const monogram = fs.readFileSync(new URL("t4d-monogram-dark.svg", output), "utf8")
  .replace(/<svg[^>]*>|<\/svg>|<title[^>]*>[\s\S]*?<\/title>|<desc[^>]*>[\s\S]*?<\/desc>/g, "");
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="title desc"><title id="title">Tools4Devs round app icon</title><desc id="desc">A graphite circle containing the interlocked gray T and D and blue four.</desc><circle cx="128" cy="128" r="128" fill="#15171c"/><g transform="translate(-226.24 -21.24) scale(.82)">${monogram}</g></svg>`;
fs.writeFileSync(new URL("tools4devs-icon-round.svg", output), icon);
const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
for (const size of sizes) {
  await sharp(Buffer.from(icon)).resize(size, size).png().toFile(fileURLToPath(new URL(`tools4devs-icon-round-${size}.png`, output)));
}

const examples = [];
const composites = [];
for (const [index, size] of [16, 24, 32, 48, 64, 128].entries()) {
  const x = 82 + index * 180;
  const png = fs.readFileSync(new URL(`tools4devs-icon-round-${size}.png`, output));
  composites.push({ input: png, left: Math.round(x + (128 - size) / 2), top: Math.round(534 + (128 - size) / 2) });
  examples.push(`<text x="${x + 64}" y="700" text-anchor="middle">${size} px</text>`);
}
const board = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="760"><rect width="1240" height="760" fill="#eef1f6"/><text x="62" y="58" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#141821">Tools4Devs / round icon</text><g transform="translate(120 133) scale(1.25)">${icon.replace(/<svg[^>]*>|<\/svg>/g, "")}</g><g font-family="Segoe UI, Arial, sans-serif" fill="#465063"><text x="544" y="230" font-size="24">T4D</text><text x="544" y="270" font-size="19">Circular graphite ground</text><text x="544" y="303" font-size="19">Gray lettering / blue four</text><text x="62" y="509" font-size="18">Actual pixel sizes</text><g font-size="16">${examples.join("")}</g></g></svg>`;
await sharp(Buffer.from(board)).composite(composites).png().toFile(fileURLToPath(new URL("tools4devs-icon-round-preview.png", output)));
console.log("Round SVG icon and 16–512 px transparent PNG exports created.");
