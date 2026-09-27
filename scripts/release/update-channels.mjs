const bridgeVersion = "3.4.0";

export function releaseManifests(version, signature, publishedAt, bridge) {
  const current = {
    version,
    notes: `See the release notes for ${version}.`,
    pub_date: publishedAt,
    platforms: {
      "windows-x86_64": {
        signature,
        url: `https://github.com/diegormirhan/tools4devs/releases/download/v${version}/tools4devs_${version}_x64-setup.exe`,
      },
    },
  };
  if (version === bridgeVersion) return { current, legacy: current };

  const platform = bridge?.platforms?.["windows-x86_64"];
  const bridgeUrl = `https://github.com/diegormirhan/tools4devs/releases/download/v${bridgeVersion}/tools4devs_${bridgeVersion}_x64-setup.exe`;
  if (bridge?.version !== bridgeVersion || !platform?.signature || platform.url !== bridgeUrl) {
    throw new Error("A signed 3.4.0 bridge manifest is required before releasing a newer version.");
  }
  return { current, legacy: bridge };
}
