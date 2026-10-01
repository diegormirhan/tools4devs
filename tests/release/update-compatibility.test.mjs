import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync("tests/release/fixtures/bridge-3.4.0.json", "utf8"));

test("the current installer recognizes the original NSIS installation and both MSI names", () => {
  const template = readFileSync("apps/desktop/src-tauri/" + config.bundle.windows.nsis.template, "utf8");
  assert.ok(template.includes('!define LEGACYUNINSTKEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ToolHaven"'));
  assert.ok(template.includes('!define LEGACYMANUPRODUCTKEY "Software\\toolhaven\\ToolHaven"'));
  assert.ok(template.includes('"ToolHaventoolhaven"'));
  assert.ok(template.includes('"tools4devstoolhaven"'));
});
