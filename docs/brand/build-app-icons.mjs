// Builds every app and browser icon from the two drawings of the D4 mark:
// the relief ("Relevo") from 48 px up, and the flat one ("Preciso") up to 32 px,
// where the relief's inner shadow blurs the 4. Windows picks the size from the .ico.
//
//   CHROMIUM=<chrome.exe> node docs/brand/build-app-icons.mjs
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const at = (path) => fileURLToPath(new URL(path, root));
const read = (path) => readFileSync(at(path), "utf8");

const tile = `<rect width="128" height="128" rx="28" fill="#172133"/>`;
const relief = read("docs/brand/final/mark-relief-app.svg")
  .replace(/<title[^>]*>[^<]*<\/title>/, `<title id="title">Tools4Devs</title>`);
const flatMark = read("docs/brand/final/mark-flat.svg")
  .replace(/^[\s\S]*?<g transform="[^"]*">/, "")
  .replace(/<\/g><\/svg>\s*$/, "");
const flat = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-labelledby="title"><title id="title">Tools4Devs</title>${tile}<g transform="translate(14 12) scale(0.9636363636363636)">${flatMark}</g></svg>\n`;
const forSize = (size) => (size <= 32 ? flat : relief);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
async function png(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="${size}" height="${size}">`);
  await page.evaluate(() => document.images[0].decode());
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

/** An .ico whose entries are PNG images, one per size: the format Windows Vista and later read. */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

async function sized(sizes) {
  const images = [];
  for (const size of sizes) images.push({ size, data: await png(forSize(size), size) });
  return images;
}

const icons = "apps/desktop/src-tauri/icons/";
const brand = "apps/desktop/public/brand/";
writeFileSync(at(`${icons}tools4devs.svg`), relief);
for (const [file, size] of [["32x32.png", 32], ["64x64.png", 64], ["128x128.png", 128], ["128x128@2x.png", 256], ["icon.png", 512]]) {
  writeFileSync(at(icons + file), await png(forSize(size), size));
}
writeFileSync(at(`${icons}icon.ico`), ico(await sized([16, 20, 24, 32, 40, 48, 64, 96, 128, 256])));
writeFileSync(at(`${brand}favicon.svg`), flat);
writeFileSync(at(`${brand}tools4devs-mark.svg`), flat);
writeFileSync(at(`${brand}favicon-32.png`), await png(flat, 32));
writeFileSync(at(`${brand}favicon.ico`), ico(await sized([16, 24, 32, 48])));
await browser.close();
console.log("icons written");
