const bridgeVersion = "3.4.0";
// The last release signed with the original updater key, which was lost on 2026-10-01.
// From the next version on, releases are signed with a new key that 4.0.0 and older do
// not trust, so their channel is frozen here and the new key gets a channel of its own.
const lastOldKeyVersion = "4.0.0";
const firstNewKeyVersion = "5.0.0";
// From here the one channel is latest.json, read by 5.0.2 and every later version. 5.0.0 and 5.0.1
// still read tools4devs-updates.json, so that file is published once more, by this release, to carry
// them over to a client that reads latest.json; the release after it publishes latest.json alone.
const unifiedFrom = "5.0.2";
const updatesChannelEnds = "5.0.3";

const installerUrl = (version) =>
  `https://github.com/diegormirhan/tools4devs/releases/download/v${version}/tools4devs_${version}_x64-setup.exe`;

const isAtLeast = (version, floor) =>
  version.localeCompare(floor, undefined, { numeric: true, sensitivity: "base" }) >= 0;

/**
 * The manifests one release publishes:
 *   current  → tools4devs-updates.json from 5.0.0 (tools4devs.json before it)
 *   oldKey   → tools4devs.json from 5.0.0, frozen at 4.0.0
 *   legacy   → latest.json, frozen at the 3.4.0 bridge
 *
 * From 5.0.2 there is one channel and none of the frozen ones: `latest` is the manifest of this
 * release, to be written as latest.json, and `updates` is the same manifest for the one release
 * that still has to be found by 5.0.0 under its old name.
 */
export function releaseManifests(version, signature, publishedAt, bridge, lastOldKey) {
  const current = {
    version,
    notes: `See the release notes for ${version}.`,
    pub_date: publishedAt,
    platforms: { "windows-x86_64": { signature, url: installerUrl(version) } },
  };
  if (version === bridgeVersion) return { current, legacy: current };
  if (isAtLeast(version, unifiedFrom)) {
    return { current, latest: current, ...(isAtLeast(version, updatesChannelEnds) ? {} : { updates: current }) };
  }

  const platform = bridge?.platforms?.["windows-x86_64"];
  if (bridge?.version !== bridgeVersion || !platform?.signature || platform.url !== installerUrl(bridgeVersion)) {
    throw new Error("A signed 3.4.0 bridge manifest is required before releasing a newer version.");
  }
  if (!isAtLeast(version, firstNewKeyVersion)) return { current, legacy: bridge };

  const oldKeyPlatform = lastOldKey?.platforms?.["windows-x86_64"];
  if (
    lastOldKey?.version !== lastOldKeyVersion ||
    !oldKeyPlatform?.signature ||
    oldKeyPlatform.url !== installerUrl(lastOldKeyVersion)
  ) {
    throw new Error("The signed 4.0.0 manifest is required: it is the frozen channel of the old key.");
  }
  return { current, oldKey: lastOldKey, legacy: bridge };
}
