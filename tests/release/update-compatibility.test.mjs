import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync("tests/release/fixtures/bridge-3.4.0.json", "utf8"));
const legacy = JSON.parse(readFileSync("tests/release/fixtures/updater-3.3.0.json", "utf8"));

test("the rename retains the installed application's data identity and updater trust", () => {
  assert.equal(config.identifier, legacy.identifier);
  assert.equal(config.plugins.updater.pubkey, legacy.plugins.updater.pubkey);
  assert.deepEqual(config.plugins.updater.windows, legacy.plugins.updater.windows);
  assert.equal(config.bundle.windows.wix.upgradeCode.toLowerCase(), "aa358e58-31a5-54d8-975a-f12ee846eb55");
  assert.equal(config.bundle.publisher, "toolhaven");
});

test("the bridge follows the new channel after old clients install it", () => {
  assert.deepEqual(config.plugins.updater.endpoints, [
    "https://github.com/diegormirhan/tools4devs/releases/latest/download/tools4devs.json",
  ]);
});

test("the current installer recognizes the original NSIS installation and both MSI names", () => {
  const template = readFileSync("apps/desktop/src-tauri/" + config.bundle.windows.nsis.template, "utf8");
  assert.ok(template.includes('!define LEGACYUNINSTKEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ToolHaven"'));
  assert.ok(template.includes('!define LEGACYMANUPRODUCTKEY "Software\\toolhaven\\ToolHaven"'));
  assert.ok(template.includes('"ToolHaventoolhaven"'));
  assert.ok(template.includes('"tools4devstoolhaven"'));
});
