import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const theme = readFileSync(
  fileURLToPath(new URL("../../apps/desktop/src/styles/theme.css", import.meta.url)),
  "utf8",
);

test("writes every literal colour inside the light or the dark token block", () => {
  const literals = [];
  let block = null;
  let depth = 0;
  for (const raw of theme.split("\n")) {
    const line = raw.trim();
    if (depth === 0 && /^(:root|\.dark)\s*\{/.test(line)) block = line;
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    // A formula over tokens, oklch(var(--l) var(--c) var(--hue)), is not a literal.
    const colour = /#[0-9a-f]{3,8}\b|\b(oklch|oklab|rgba?|hsla?|lab|lch)\(\s*[\d.]/i.test(line);
    if (colour && !block && !line.startsWith("/*")) literals.push(line);
    if (depth === 0) block = null;
  }

  assert.deepEqual(literals, []);
});

test("gives the light and the dark theme the same tokens", () => {
  const names = (selector) => {
    const start = theme.search(new RegExp(`^${selector}\\s*\\{`, "m"));
    const body = theme.slice(start, theme.indexOf("}", start));
    return [...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]).sort();
  };
  const light = names(":root");
  const dark = names("\\.dark");

  // --radius is shared; everything else must be redefined for dark.
  assert.deepEqual(dark, light.filter((name) => name !== "--radius"));
});
