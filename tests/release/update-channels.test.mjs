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
