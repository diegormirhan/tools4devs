import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const sharp = createRequire(import.meta.url)("C:/Users/mirha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");
const output = new URL("./", import.meta.url);
const shadow = `<defs><filter id="letter-shadow" x="-30%" y="-30%" width="160%" height="180%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="4" stdDeviation="2.4" flood-color="#000000" flood-opacity="0.65"/></filter></defs>`;

function withShadow(svg) {
  return svg.replace(/<svg[^>]*>/, opening => opening + shadow).replace(/<(path|ellipse) /g, '<$1 filter="url(#letter-shadow)" ');
}

for (const name of ["tools4devs-shared-d", "t4d-monogram"]) {
  const source = fs.readFileSync(new URL(`${name}-dark.svg`, output), "utf8");
  fs.writeFileSync(new URL(`${name}-shadow-dark.svg`, output), withShadow(source));
}

function geometry(name, shadowed) {
  const source = fs.readFileSync(new URL(`${name}-dark.svg`, output), "utf8");
  const inner = source.replace(/<svg[^>]*>|<\/svg>|<title[^>]*>[\s\S]*?<\/title>|<desc[^>]*>[\s\S]*?<\/desc>/g, "");
  return shadowed ? inner.replace(/<(path|ellipse) /g, '<$1 filter="url(#letter-shadow)" ') : inner;
}

const composition = shadowed => `<svg xmlns="http://www.w3.org/2000/svg" width="989" height="491" viewBox="0 0 989 491" role="img" aria-label="Tools4Devs logo shadow experiment">${shadow}<rect width="989" height="491" fill="#111111"/><g transform="translate(35 -52)">${geometry("t4d-monogram", shadowed)}${geometry("tools4devs-shared-d", shadowed)}</g></svg>`;
const preview = composition(true);
fs.writeFileSync(new URL("tools4devs-shadow-preview.svg", output), preview);
await sharp(Buffer.from(preview)).resize(1484, 737).png().toFile(fileURLToPath(new URL("tools4devs-shadow-preview.png", output)));
const comparison = `<svg xmlns="http://www.w3.org/2000/svg" width="989" height="1062"><rect width="989" height="1062" fill="#111111"/><g font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#a3aec0"><text x="45" y="30">01 / Without shadow</text><text x="45" y="561">02 / Soft shadow</text></g><g transform="translate(0 40)">${composition(false).replace(/<svg[^>]*>|<\/svg>/g, "")}</g><g transform="translate(0 571)">${composition(true).replace(/<svg[^>]*>|<\/svg>/g, "")}</g></svg>`;
await sharp(Buffer.from(comparison)).png().toFile(fileURLToPath(new URL("tools4devs-shadow-comparison.png", output)));
console.log("Created shadow variants and comparison; original SVGs preserved.");
