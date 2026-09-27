import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const sharp = createRequire(import.meta.url)("C:/Users/mirha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");
const output = new URL("flat/", import.meta.url);
fs.mkdirSync(output, { recursive: true });
const colors = { navy: "#151C2A", white: "#F2F4F7", blue: "#3E83D5" };
const four = "M145 56 83 152H172M145 56V194";
const standardT = "M34 56H145M82 56V194";
const curvedT = "M19 78C19 64 31 56 47 56H117C133 56 145 64 145 78M82 56V194";
const standardD = "M153 56H178C220 56 240 82 240 125S220 194 178 194H153V56";
const svg = (title, box, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" role="img" aria-labelledby="title"><title id="title">${title}</title>${body}</svg>`;

function symbol(id, inverted = false, curved = false) {
  const letters = (curved ? curvedT : standardT) + standardD;
  return `<defs><mask id="knockout-${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="270" height="256"><rect width="270" height="256" fill="white"/><path d="${four}" fill="none" stroke="black" stroke-width="27" stroke-linecap="round" stroke-linejoin="round"/></mask></defs><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${letters}" stroke="${colors.white}" stroke-width="14" mask="url(#knockout-${id})"/><path d="${four}" stroke="${inverted ? colors.white : colors.blue}" stroke-width="17"/></g>`;
}

function appIcon(id, inverted = false, curved = false) {
  const scaleX = curved ? 176 / 235 : .8;
  const centerX = curved ? 129.5 : 137;
  const offsetX = 128 - scaleX * centerX;
  return svg("tools4devs T4D app icon", "0 0 256 256", `<rect width="256" height="256" rx="57" fill="${inverted ? colors.blue : colors.navy}"/><g transform="translate(${offsetX} 38) scale(${scaleX} .72)">${symbol(id, inverted, curved)}</g>`);
}

const microIcon = svg("tools4devs small four icon", "0 0 256 256", `<rect width="256" height="256" rx="57" fill="${colors.navy}"/><path d="M155 58 82 155H177M155 58V198" fill="none" stroke="${colors.blue}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`);
const darkIcon = appIcon("dark");
const blueIcon = appIcon("blue", true);
const curvedIcon = appIcon("curved", false, true);
const curvedBlueIcon = appIcon("curved-blue", true, true);
const bareSymbol = svg("tools4devs T4D symbol", "15 36 245 178", symbol("bare"));
const outlines = JSON.parse(fs.readFileSync(new URL("flat-wordmark-paths.json", import.meta.url), "utf8"));
function wordmark(ink) {
  const scale = 110 / outlines.unitsPerEm;
  const width = outlines.width * scale + 16;
  const paths = outlines.paths.map(glyph => `<path d="${glyph.path}" transform="translate(${8 + glyph.x * scale} 95) scale(${scale} ${-scale})" fill="${glyph.letter === "4" ? colors.blue : ink}"/>`).join("");
  return svg("tools4devs wordmark — Inter Tight Semibold", `0 0 ${width} 120`, paths);
}
const darkWordmark = wordmark(colors.white);
const lightWordmark = wordmark(colors.navy);
const assets = {
  "tools4devs-app-icon.svg": darkIcon,
  "tools4devs-app-icon-inverted.svg": blueIcon,
  "tools4devs-app-icon-curved-t.svg": curvedIcon,
  "tools4devs-app-icon-curved-t-inverted.svg": curvedBlueIcon,
  "tools4devs-symbol-curved-t.svg": svg("tools4devs curved T4D symbol", "0 36 260 178", symbol("curved-bare", false, true)),
  "tools4devs-small-icon.svg": microIcon,
  "tools4devs-symbol.svg": bareSymbol,
  "tools4devs-wordmark-dark.svg": darkWordmark,
  "tools4devs-wordmark-light.svg": lightWordmark,
};
for (const [name, content] of Object.entries(assets)) {
  if (/linearGradient|filter=|feDropShadow|<text/.test(content)) throw new Error(`${name}: not a flat outlined asset`);
  fs.writeFileSync(new URL(name, output), content);
}
for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
  const source = size <= 32 ? microIcon : darkIcon;
  await sharp(Buffer.from(source)).resize(size, size).png().toFile(fileURLToPath(new URL(`tools4devs-icon-${size}.png`, output)));
}
await sharp(Buffer.from(microIcon)).resize(32, 32).png().toFile(fileURLToPath(new URL("favicon-32.png", output)));
const inside = content => content.replace(/<svg[^>]*>|<\/svg>/g, "");
const wordWidth = outlines.width * 110 / outlines.unitsPerEm + 16;
const composites = [];
const smallLabels = [];
for (const [index, size] of [16, 24, 32, 48, 64].entries()) {
  const x = 756 + index * 94;
  composites.push({ input: fs.readFileSync(new URL(`tools4devs-icon-${size}.png`, output)), left: Math.round(x + (64 - size) / 2), top: Math.round(576 + (64 - size) / 2) });
  smallLabels.push(`<text x="${x + 32}" y="675" text-anchor="middle">${size} px</text>`);
}
const board = `<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="810"><rect width="1320" height="810" fill="#111722"/><g font-family="Segoe UI, Arial, sans-serif" fill="#AEB8C8" font-size="17"><text x="55" y="55">tools4devs / flat identity</text><text x="55" y="114">01 / App icon</text><text x="395" y="114">02 / Inverted</text><text x="775" y="114">03 / Small icon</text><text x="55" y="497">04 / Wordmark — Inter Tight Semibold</text><text x="756" y="533">Actual pixel sizes</text>${smallLabels.join("")}</g><g transform="translate(55 144) scale(1.05)">${inside(darkIcon)}</g><g transform="translate(395 144) scale(1.05)">${inside(blueIcon)}</g><g transform="translate(805 160) scale(.9)">${inside(microIcon)}</g><g transform="translate(48 537) scale(${625 / wordWidth})">${inside(darkWordmark)}</g></svg>`;
fs.writeFileSync(new URL("identity-preview.svg", output), board);
await sharp(Buffer.from(board)).composite(composites).png().toFile(fileURLToPath(new URL("identity-preview.png", output)));
const comparison = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1010"><rect width="1200" height="1010" fill="#111722"/><g font-family="Segoe UI, Arial, sans-serif" fill="#AEB8C8" font-size="18"><text x="88" y="65">01 / Straight T</text><text x="688" y="65">02 / Curved T — both ends</text></g><g transform="translate(90 110) scale(1.55)">${inside(darkIcon)}</g><g transform="translate(690 110) scale(1.55)">${inside(curvedIcon)}</g><g transform="translate(90 575) scale(1.35)">${inside(blueIcon)}</g><g transform="translate(690 575) scale(1.35)">${inside(curvedBlueIcon)}</g></svg>`;
fs.writeFileSync(new URL("t-variants-preview.svg", output), comparison);
await sharp(Buffer.from(comparison)).png().toFile(fileURLToPath(new URL("t-variants-preview.png", output)));
await sharp(Buffer.from(curvedIcon)).resize(512, 512).png().toFile(fileURLToPath(new URL("tools4devs-app-icon-curved-t-512.png", output)));

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
const pairs = [["Off-white / navy", colors.white, colors.navy], ["Blue / navy", colors.blue, colors.navy], ["Off-white / blue", colors.white, colors.blue]];
const ratios = pairs.map(([label, a, b]) => {
  const ratio = (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  if (ratio < 3) throw new Error(`${label}: contrast below 3:1`);
  return `| ${label} | ${ratio.toFixed(2)}:1 |`;
});
fs.writeFileSync(new URL("README.md", output), `# tools4devs flat identity\n\nDraft assets; not yet installed in the app or landing page.\n\n- Navy: ${colors.navy}. Off-white: ${colors.white}. One brand blue: ${colors.blue}.\n- Straight and symmetrically curved T variants; full four crossbar; 5-unit knockout gap at the native monogram scale.\n- Filled squircle without an outline; larger 176-unit-wide monogram, 10% vertical compression, and heavier strokes.\n- Use the four-only variant at 16–32 px; T4D at 48 px and above.\n- Inter Tight Semibold outlined wordmark; only the four is blue. Font already used by the landing page and distributed under SIL OFL.\n- No gradients or shadows.\n\n## Solid-color contrast\n\n| Pair | Ratio |\n|---|---|\n${ratios.join("\n")}\n\nThe inverted logo is a brand mark, not body text. Ratios are color measurements, not a certification of recognition at small sizes.\n`);
fs.copyFileSync(new URL("../../../toolhaven-desktop-landing/assets/fonts/OFL.txt", import.meta.url), new URL("OFL.txt", output));
console.log(ratios.join("\n"));
