import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const sharp = createRequire(import.meta.url)("C:/Users/mirha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");
const output = new URL("./", import.meta.url);
const themes = {
  dark: { ink: "#d4d4d4", blue: "#60a5ed", background: "#111111" },
  light: { ink: "#303742", blue: "#2a55c4", background: "#f2f5fa" },
};
const header = (title, box, description) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" role="img" aria-labelledby="title desc"><title id="title">${title}</title><desc id="desc">${description}</desc>`;

function monogram(colors) {
  return `<g fill="none" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"><path d="M328 126H478M376 126V238M445 126H478C517 126 536 147 536 181S517 237 478 237H445V126" stroke="${colors.ink}"/><path d="M435 124 375 212H457M435 124V240" stroke="${colors.blue}"/></g>`;
}

function wordmark(colors) {
  return `<g fill="none" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"><g stroke="${colors.ink}"><path d="M54 349H148M101 349V461M362 348V446Q362 461 380 461H387"/><ellipse cx="191" cy="423" rx="35" ry="38"/><ellipse cx="291" cy="423" rx="35" ry="38"/><path d="M513 363H546C586 363 603 384 603 418S584 474 546 474H513V363M700 468C687 475 675 478 663 474C646 470 637 457 637 439C637 417 649 400 668 400C688 400 701 413 701 436H638M727 401 761 474 796 401M876 407C857 396 829 397 824 414C815 444 879 431 876 457C873 480 843 481 821 469"/></g><path d="M506 359 445 449H527M506 359V476" stroke="${colors.blue}"/><path d="M463 391C449 383 426 383 416 393C404 406 415 419 437 425C454 429 465 435 463 447C460 463 431 466 408 455" stroke="${colors.ink}"/></g>`;
}

for (const [theme, colors] of Object.entries(themes)) {
  fs.writeFileSync(new URL(`tools4devs-shared-d-${theme}.svg`, output), header("Tools4Devs", "38 327 861 171", "Rounded gray Tools and Devs with a blue four overlapping the uppercase D. Vector paths based on the supplied reference.") + wordmark(colors) + "</svg>");
  fs.writeFileSync(new URL(`t4d-monogram-${theme}.svg`, output), header("T4D", "311 107 243 152", "Interlocked gray T and D with a blue four in front, based on the supplied reference.") + monogram(colors) + "</svg>");
}

const board = header("Tools4Devs logo concepts", "0 0 1034 569", "The T4D monogram above the Tools4Devs wordmark on a dark background.") + `<rect width="1034" height="569" fill="${themes.dark.background}"/>` + monogram(themes.dark) + wordmark(themes.dark) + "</svg>";
fs.writeFileSync(new URL("tools4devs-shared-d-preview.svg", output), board);
await sharp(Buffer.from(board)).resize(1551, 854).png().toFile(fileURLToPath(new URL("tools4devs-shared-d-preview.png", output)));

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

const rows = [];
for (const [theme, colors] of Object.entries(themes)) {
  for (const [element, color] of [["Lettering", colors.ink], ["Four", colors.blue]]) {
    const a = luminance(color);
    const b = luminance(colors.background);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < 4.5) throw new Error(`${theme} ${element}: insufficient background contrast`);
    rows.push(`| ${theme} | ${element} | ${color} / ${colors.background} | ${ratio.toFixed(2)}:1 |`);
  }
}
fs.writeFileSync(new URL("SHARED-D-CONTRAST.md", output), `# Reference-based logo contrast\n\nVector paths with rounded caps and joins. No font dependency.\n\n| Theme | Element | Colors | Contrast |\n|---|---|---|---|\n${rows.join("\n")}\n\nRatios use sRGB relative luminance on the specified backgrounds. The overlapping blue/gray boundary is not a text/background pair. These checks do not certify recognition at small sizes.\n`);
console.log(rows.join("\n"));
