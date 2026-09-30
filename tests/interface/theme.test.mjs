import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const theme = readFileSync(
  fileURLToPath(new URL("../../apps/desktop/src/styles/theme.css", import.meta.url)),
  "utf8",
);

test("does not load Tailwind's preflight while the legacy stylesheet still renders screens", () => {
  // Preflight resets margins, borders and headings on every element. The screens
  // not yet migrated rely on the browser defaults it would remove.
  assert.doesNotMatch(theme, /@import\s+["']tailwindcss["']/);
  assert.doesNotMatch(theme, /tailwindcss\/preflight/);
});

test("resets only the new interface, never a screen app.css still draws", () => {
  // shadcn's components expect Tailwind's reset; the legacy screens inside the
  // frame expect the browser defaults, so the reset stops at data-legacy.
  assert.match(theme, /@scope \(\[data-slot\]\) to \(\[data-legacy\]\)/);
});

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
