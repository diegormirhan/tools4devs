import assert from "node:assert/strict";
import test from "node:test";
import { releaseManifests } from "../../scripts/release/update-channels.mjs";

test("3.4.0 offers the same signed bridge to both channels", () => {
  const manifests = releaseManifests("3.4.0", "signed-bridge", "2026-09-27T00:00:00Z");
  assert.deepEqual(manifests.legacy, manifests.current);
  assert.equal(manifests.legacy.version, "3.4.0");
});

test("old clients stop at the bridge while the bridge sees the current release", () => {
  const bridge = releaseManifests("3.4.0", "signed-bridge", "2026-09-27T00:00:00Z").current;
  const manifests = releaseManifests("4.0.0", "signed-current", "2026-09-28T00:00:00Z", bridge);
  assert.deepEqual(manifests.legacy, bridge);
  assert.equal(manifests.current.version, "4.0.0");
  assert.equal(manifests.current.platforms["windows-x86_64"].signature, "signed-current");
  assert.match(manifests.legacy.platforms["windows-x86_64"].url, /v3\.4\.0\/tools4devs_3\.4\.0_x64-setup\.exe$/);
});

test("a newer release cannot silently bypass a missing or invalid bridge", () => {
  assert.throws(() => releaseManifests("4.0.0", "signed-current", "2026-09-28T00:00:00Z"), /bridge/i);
  assert.throws(() => releaseManifests("4.0.0", "signed-current", "2026-09-28T00:00:00Z", { version: "4.0.0" }), /bridge/i);
});

test("from 5.0.0, clients of the lost key stop at 4.0.0 and only the new channel names the release", () => {
  const bridge = releaseManifests("3.4.0", "signed-bridge", "2026-09-27T00:00:00Z").current;
  const lastOldKey = releaseManifests("4.0.0", "signed-old-key", "2026-09-28T00:00:00Z", bridge).current;
  const manifests = releaseManifests("5.0.0", "signed-new-key", "2026-10-01T00:00:00Z", bridge, lastOldKey);
  assert.deepEqual(manifests.legacy, bridge);
  assert.deepEqual(manifests.oldKey, lastOldKey);
  assert.equal(manifests.current.version, "5.0.0");
  assert.equal(manifests.current.platforms["windows-x86_64"].signature, "signed-new-key");
});

test("a release on the new key cannot ship without the frozen 4.0.0 manifest", () => {
  const bridge = releaseManifests("3.4.0", "signed-bridge", "2026-09-27T00:00:00Z").current;
  assert.throws(() => releaseManifests("5.0.0", "signed-new-key", "2026-10-01T00:00:00Z", bridge), /4\.0\.0/);
  assert.throws(
    () => releaseManifests("5.0.0", "signed-new-key", "2026-10-01T00:00:00Z", bridge, { version: "5.0.0" }),
    /4\.0\.0/,
  );
});

// From 5.0.1 there is one channel, latest.json. Who reads what, and what each release must publish:
//   5.0.0 reads tools4devs-updates.json, so the first unified release still writes it;
//   5.0.1 and later read latest.json, so 5.0.2 can drop the old name.
test("5.0.1 writes latest.json, and tools4devs-updates.json once more so that 5.0.0 can find it", () => {
  const manifests = releaseManifests("5.0.1", "signed-new-key", "2026-10-14T00:00:00Z");
  assert.equal(manifests.latest.version, "5.0.1");
  assert.deepEqual(manifests.updates, manifests.latest);
  // None of the frozen channels survives: they are not given, and not needed.
  assert.equal(manifests.oldKey, undefined);
  assert.equal(manifests.legacy, undefined);
});

test("from 5.0.2 a release publishes latest.json and nothing else", () => {
  for (const version of ["5.0.2", "5.1.0", "6.0.0"]) {
    const manifests = releaseManifests(version, "signed-new-key", "2026-10-20T00:00:00Z");
    assert.equal(manifests.latest.version, version);
    assert.match(manifests.latest.platforms["windows-x86_64"].url, new RegExp(`v${version}/tools4devs_${version}_x64-setup\.exe$`));
    assert.deepEqual(Object.keys(manifests).sort(), ["current", "latest"], version);
  }
});

test("5.0.0 keeps the frozen channels it already had", () => {
  const bridge = releaseManifests("3.4.0", "signed-bridge", "2026-09-27T00:00:00Z").current;
  const lastOldKey = releaseManifests("4.0.0", "signed-old-key", "2026-09-28T00:00:00Z", bridge).current;
  const manifests = releaseManifests("5.0.0", "signed-new-key", "2026-10-01T00:00:00Z", bridge, lastOldKey);
  assert.equal(manifests.latest, undefined);
  assert.deepEqual(manifests.legacy, bridge);
});

test("the app reads latest.json from 5.0.1 on, and no other address", async () => {
  const { readFile } = await import("node:fs/promises");
  const config = JSON.parse(await readFile(new URL("../../apps/desktop/src-tauri/tauri.conf.json", import.meta.url), "utf8"));
  assert.deepEqual(config.plugins.updater.endpoints, [
    "https://github.com/diegormirhan/tools4devs/releases/latest/download/latest.json",
  ]);
});
