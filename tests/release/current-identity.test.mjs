import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("4.0.0 uses the new identity while retaining the MSI upgrade family", () => {
  const config = JSON.parse(readFileSync("apps/desktop/src-tauri/tauri.conf.json", "utf8"));
  assert.equal(config.identifier, "com.tools4devs.desktop");
  assert.equal(config.bundle.publisher, "tools4devs");
  assert.equal(config.bundle.windows.wix.upgradeCode, "aa358e58-31a5-54d8-975a-f12ee846eb55");
  const installer = readFileSync("apps/desktop/src-tauri/" + config.bundle.windows.nsis.template, "utf8");
  assert.ok(installer.includes('!define UNINSTKEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\tools4devs"'));
  assert.ok(installer.includes('!define MANUPRODUCTKEY "Software\\tools4devs\\tools4devs"'));
});
