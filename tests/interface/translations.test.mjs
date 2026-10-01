import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const interfaceRoot = fileURLToPath(new URL("../../apps/desktop/src", import.meta.url));

/**
 * Every English string the app can put on screen, gathered from the source.
 *
 * Two shapes reach the screen: a literal handed straight to the translator,
 * `t("Run")`, and a label held in data and translated where it is shown —
 * the catalog's titles, an option's label and hint. Both are collected here,
 * so a string added without a translation fails this rather than quietly
 * showing English to somebody who chose Portuguese.
 */
function sources(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "i18n") found.push(...sources(full));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
      found.push(full);
    }
  }
  return found;
}

/** The start of a call to the translator, and not of `format(` or `.at(`. */
const call = /(^|[^\w.$])t\(/g;
/** A table of labels looked up by a key, such as a job status. */
const labelTable = /const \w*[Ll]abels[^=]*=\s*\{([^}]*)\}/g;
/** Text carried in data and translated at the point it is shown. */
const carried = /\b(?:title|description|label|hint|downloadLabel)\s*:\s*"((?:[^"\\]|\\.)*)"/g;

function collect() {
  const strings = new Set();
  for (const file of sources(interfaceRoot)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(call)) {
      // Everything quoted inside the call, so `t(busy ? "A" : "B")` and a call
      // broken over four lines are both read.
      for (const value of quotedWithin(text, match.index + match[0].length)) {
        strings.add(value);
      }
    }
    for (const [, value] of text.matchAll(carried)) strings.add(unescape(value));
    // A `…Labels` table is looked up by a status or a phase, so its values
    // reach the screen without ever appearing beside a `t(`.
    for (const [, body] of text.matchAll(labelTable)) {
      for (const [, value] of body.matchAll(/"((?:[^"\\]|\\.)*)"/g)) strings.add(unescape(value));
    }
  }
  return strings;
}

/** The literals between here and the paren that closes the call. */
function quotedWithin(text, from) {
  const found = [];
  let depth = 1;
  let index = from;
  while (index < text.length && depth > 0) {
    const character = text[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === '"') {
      // `t(phase === "checking" ? … : …)` holds a literal that is a state
      // being compared, not a sentence anybody reads.
      const compared = /[=!]==?\s*$/.test(text.slice(Math.max(0, index - 6), index));
      let value = "";
      index += 1;
      while (index < text.length && text[index] !== '"') {
        if (text[index] === "\\") {
          value += text[index] + text[index + 1];
          index += 2;
          continue;
        }
        value += text[index];
        index += 1;
      }
      if (!compared) found.push(unescape(value));
    }
    index += 1;
  }
  return found;
}

function unescape(value) {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

/** The dictionary's keys, read as text so the test needs no bundler. */
function dictionary() {
  const keys = new Set();
  for (const name of ["pt.ts", "catalog-pt.ts"]) {
    const text = readFileSync(path.join(interfaceRoot, "i18n", name), "utf8");
    const body = text.slice(text.indexOf("= {"));
    for (const [, quoted, bare] of body.matchAll(
      /^\s{2}(?:"((?:[^"\\]|\\.)*)"|([A-Za-z_$][\w$]*))\s*:/gm,
    )) {
      keys.add(quoted == null ? bare : unescape(quoted));
    }
  }
  return keys;
}

test("every string the interface can show has a Portuguese translation", () => {
  const known = dictionary();
  const missing = [...collect()].filter((text) => text.trim() && !known.has(text)).sort();
  assert.deepEqual(missing, []);
});
