import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync("apps/desktop/src-tauri/tauri.conf.json", "utf8"));
const legacy = JSON.parse(readFileSync("tests/release/fixtures/updater-3.3.0.json", "utf8"));

test("the rename retains the installed application's data identity and updater trust", () => {
  assert.equal(config.identifier, legacy.identifier);
  assert.deepEqual(config.plugins.updater, legacy.plugins.updater);
  assert.equal(config.bundle.windows.wix.upgradeCode.toLowerCase(), "aa358e58-31a5-54d8-975a-f12ee846eb55");
  assert.equal(config.bundle.publisher, "toolhaven");
});

test("the installer recognizes the original NSIS installation and renamed MSI", () => {
  const template = readFileSync("apps/desktop/src-tauri/" + config.bundle.windows.nsis.template, "utf8");
  assert.ok(template.includes('!define UNINSTKEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ToolHaven"'));
  assert.ok(template.includes('!define MANUPRODUCTKEY "Software\\toolhaven\\ToolHaven"'));
  assert.ok(template.includes('"ToolHaventoolhaven"'));
});
