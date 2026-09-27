import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const sharp = createRequire(import.meta.url)("C:/Users/mirha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");
const source = new URL("flat/", import.meta.url);
const output = new URL("final/", import.meta.url);
fs.mkdirSync(output, { recursive: true });
const selected = {
  "app-icon.svg": "tools4devs-app-icon.svg",
  "app-icon-inverted.svg": "tools4devs-app-icon-inverted.svg",
  "small-icon.svg": "tools4devs-small-icon.svg",
  "favicon.svg": "tools4devs-small-icon.svg",
  "symbol.svg": "tools4devs-symbol.svg",
  "wordmark-dark.svg": "tools4devs-wordmark-dark.svg",
  "wordmark-light.svg": "tools4devs-wordmark-light.svg",
  "OFL.txt": "OFL.txt",
};
for (const [name, original] of Object.entries(selected)) fs.copyFileSync(new URL(original, source), new URL(name, output));
const read = name => fs.readFileSync(new URL(name, output), "utf8");
const inner = svg => svg.replace(/<svg[^>]*>|<\/svg>/g, "");
const icon = read("app-icon.svg");
const inverted = read("app-icon-inverted.svg");
const micro = read("small-icon.svg");
const darkWordmark = read("wordmark-dark.svg");
const lightWordmark = read("wordmark-light.svg");
for (const size of [16, 20, 24, 32, 40, 48, 64, 96, 128, 256, 512, 1024]) {
  await sharp(Buffer.from(size <= 40 ? micro : icon)).resize(size, size).png().toFile(fileURLToPath(new URL(`icon-${size}.png`, output)));
}
for (const theme of ["dark", "light"]) {
  await sharp(Buffer.from(read(`wordmark-${theme}.svg`))).resize({ width: 1600 }).png().toFile(fileURLToPath(new URL(`wordmark-${theme}.png`, output)));
}
await sharp(Buffer.from(inverted)).resize(512, 512).png().toFile(fileURLToPath(new URL("app-icon-inverted-512.png", output)));
const composites = [];
const labels = [];
for (const [index, size] of [16, 24, 32, 48, 64, 96, 128].entries()) {
  const x = 104 + index * 200;
  composites.push({ input: fs.readFileSync(new URL(`icon-${size}.png`, output)), left: Math.round(x + (128 - size) / 2), top: Math.round(1260 + (128 - size) / 2) });
  labels.push(`<text x="${x + 64}" y="1424" text-anchor="middle">${size} px</text>`);
}
composites.push({ input: fs.readFileSync(new URL("icon-16.png", output)), left: 111, top: 989 });
composites.push({ input: fs.readFileSync(new URL("icon-32.png", output)), left: 1168, top: 1023 });
const board = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1500" viewBox="0 0 1600 1500"><rect width="1600" height="1500" fill="#101620"/><rect y="470" width="1600" height="360" fill="#F2F4F7"/><g font-family="Segoe UI, Arial, sans-serif"><text x="72" y="62" font-size="18" fill="#AEB8C8">tools4devs / final identity study</text><text x="72" y="430" font-size="17" fill="#AEB8C8">Straight T · full four crossbar · clear knockout · flat colors</text><text x="72" y="795" font-size="16" fill="#465063">NAVY #151C2A</text><text x="312" y="795" font-size="16" fill="#465063">OFF-WHITE #F2F4F7</text><text x="620" y="795" font-size="16" fill="#465063">BLUE #3E83D5</text><text x="72" y="897" font-size="18" fill="#AEB8C8">Placement studies</text><text x="72" y="937" font-size="15" fill="#AEB8C8">Browser favicon / 16 px</text><text x="846" y="937" font-size="15" fill="#AEB8C8">Windows taskbar / 32 px</text><text x="72" y="1200" font-size="18" fill="#AEB8C8">Actual pixel sizes / four-only at 16–40 px, T4D from 48 px</text><g font-size="16" fill="#AEB8C8">${labels.join("")}</g></g><g transform="translate(88 116) scale(1.05)">${inner(icon)}</g><g transform="translate(448 143) scale(1.9)">${inner(darkWordmark)}</g><g transform="translate(88 520) scale(.7)">${inner(icon)}</g><g transform="translate(304 520) scale(.7)">${inner(inverted)}</g><g transform="translate(556 534) scale(1.76)">${inner(lightWordmark)}</g><rect x="72" y="961" width="708" height="159" rx="18" fill="#DCE3EC"/><path d="M93 961H329Q343 961 343 975V1018H88V975Q88 961 93 961Z" fill="#FFFFFF"/><rect x="72" y="1017" width="708" height="103" rx="18" fill="#FFFFFF"/><rect x="94" y="1037" width="660" height="40" rx="20" fill="#EDF1F6"/><g font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#303B4D"><text x="140" y="1003">tools4devs</text><text x="127" y="1063">tools4devs — local tools, one app</text></g><rect x="846" y="961" width="682" height="159" rx="18" fill="#1D2431"/><rect x="1076" y="1015" width="46" height="46" rx="9" fill="#2B3547"/><g fill="#88AFFF"><rect x="1086" y="1025" width="9" height="9"/><rect x="1098" y="1025" width="9" height="9"/><rect x="1086" y="1037" width="9" height="9"/><rect x="1098" y="1037" width="9" height="9"/></g><rect x="1157" y="1014" width="54" height="51" rx="9" fill="#2B3547"/><rect x="1175" y="1070" width="18" height="3" rx="1.5" fill="#3E83D5"/><rect x="1250" y="1027" width="30" height="25" rx="4" fill="#65758F"/></svg>`;
const embeddedSizes = composites.map(item => `<image x="${item.left}" y="${item.top}" width="${item.input.readUInt32BE(16)}" height="${item.input.readUInt32BE(20)}" href="data:image/png;base64,${item.input.toString("base64")}"/>`).join("");
const completeBoard = board.replace("</svg>", `${embeddedSizes}</svg>`);
fs.writeFileSync(new URL("tools4devs-final-mockup.svg", output), completeBoard);
await sharp(Buffer.from(completeBoard)).png().toFile(fileURLToPath(new URL("tools4devs-final-mockup.png", output)));
fs.writeFileSync(new URL("README.md", output), `# tools4devs selected identity\n\nSelected direction: straight T, longer four crossbar, heavier strokes, clear knockout. Flat colors only.\n\n## Assets\n\n- app-icon.svg: T4D squircle for large sizes.\n- app-icon-inverted.svg: off-white monogram on blue.\n- small-icon.svg and favicon.svg: simplified blue four.\n- wordmark-dark.svg and wordmark-light.svg: outlined Inter Tight Semibold; only the four is blue.\n- icon-16.png through icon-1024.png: transparency retained outside the squircle. Sizes through 40 px use the four; sizes from 48 px use T4D.\n- app-icon.ico: Windows multi-size icon with the corresponding small/large variants.\n- favicon.ico: four-only browser icon.\n- tools4devs-final-mockup.png: presentation with illustrative placement studies, not screenshots of the installed app or live site.\n\nThe SVGs contain outlined geometry and have no font dependency. Inter Tight is licensed under SIL OFL; see OFL.txt.\n\nPalette: navy #151C2A, off-white #F2F4F7, blue #3E83D5. Solid color contrast: off-white/navy 15.48:1, blue/navy 4.40:1, off-white/blue 3.52:1. Recognition at small sizes is handled by the four-only variant, not by those color ratios.\n\nThese assets have not yet been applied to the desktop app or landing page.\n`);
console.log("Final mockup and 12 PNG size variants exported.");
