import assert from "node:assert/strict";
import test from "node:test";
import { isPermissive, productionPackages, renderFrontendNotices } from "../../scripts/notices/frontend-notices.mjs";

const lock = {
  packages: {
    "": { name: "tools4devs-desktop" },
    "node_modules/react": { version: "19.2.8", license: "MIT" },
    "node_modules/vite": { version: "8.2.2", license: "MIT", dev: true },
    "node_modules/fsevents": { version: "2.3.3", license: "MIT", devOptional: true },
    "node_modules/cliui/node_modules/wrap-ansi": { version: "6.2.0", license: "MIT" },
    "node_modules/other/node_modules/wrap-ansi": { version: "6.2.0", license: "MIT" },
  },
};

test("lists what ships in the bundle: production packages, nested ones included, once each", () => {
  assert.deepEqual(
    productionPackages(lock).map(({ name, version, path }) => [name, version, path]),
    [
      ["react", "19.2.8", "node_modules/react"],
      ["wrap-ansi", "6.2.0", "node_modules/cliui/node_modules/wrap-ansi"],
    ],
  );
});

test("accepts a licence expression only when every required branch is permissive", () => {
  assert.equal(isPermissive("MIT"), true);
  assert.equal(isPermissive("OFL-1.1"), true);
  assert.equal(isPermissive("(MIT OR Apache-2.0)"), true);
  assert.equal(isPermissive("MIT OR GPL-3.0-only"), true);
  assert.equal(isPermissive("MIT AND GPL-3.0-only"), false);
  assert.equal(isPermissive("GPL-3.0-or-later"), false);
  assert.equal(isPermissive(undefined), false);
});

test("carries each package's own licence text, which MIT and the OFL both require", () => {
  const text = renderFrontendNotices([
    { name: "react", version: "19.2.8", license: "MIT", licenceText: "Copyright (c) Meta Platforms, Inc.", repository: null },
  ]);
  assert.match(text, /react 19\.2\.8\n {2}License: MIT\n\nCopyright \(c\) Meta Platforms, Inc\./);
});

test("points to the source when the published package has no licence file", () => {
  const text = renderFrontendNotices([
    { name: "jsbarcode", version: "3.12.3", license: "MIT", licenceText: null, repository: "https://github.com/lindell/JsBarcode" },
  ]);
  assert.match(text, /jsbarcode 3\.12\.3\n {2}License: MIT\n {2}No licence file in the published package; see https:\/\/github\.com\/lindell\/JsBarcode/);
});

test("refuses to write notices for a copyleft package instead of shipping it quietly", () => {
  assert.throws(
    () => renderFrontendNotices([{ name: "gpl-thing", version: "1.0.0", license: "GPL-3.0-only", licenceText: "", repository: null }]),
    /gpl-thing 1\.0\.0: GPL-3\.0-only/,
  );
});
