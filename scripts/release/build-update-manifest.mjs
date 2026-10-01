/**
 * Writes the update manifests: tools4devs-updates.json for clients of the current
 * signing key, tools4devs.json frozen at 4.0.0 for clients of the lost original key,
 * and latest.json frozen at the 3.4.0 bridge for the oldest clients.
 *
 * The updater asks one address for a small document naming the newest version
 * and where to get it, and refuses anything whose signature does not match the
 * public key compiled into the binary. This builds that document from the
 * artifacts `tauri build` just signed.
 *
 *   node scripts/release/build-update-manifest.mjs
 *
 * With no argument it writes into `Releases/<version>`, which is where every
 * version's artifacts are staged. A path can still be given to override it.
 *
 * Every file belongs in every GitHub release: each installed version reads one of
 * them from the latest release, and must keep finding it there.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { releaseManifests } from "./update-channels.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const directory = path.resolve(root, process.argv[2] ?? path.join("Releases", version));
if (!existsSync(directory)) {
  console.error(`No such release directory: ${directory}`);
  console.error("Usage: node scripts/release/build-update-manifest.mjs [release directory]");
  process.exit(1);
}
const installer = `tools4devs_${version}_x64-setup.exe`;
const signaturePath = path.join(directory, `${installer}.sig`);

if (!existsSync(path.join(directory, installer)) || !existsSync(signaturePath)) {
  console.error(
    `No signature beside ${installer}.\n` +
      "Build with TAURI_SIGNING_PRIVATE_KEY set, or the update will be refused by every client.",
  );
  process.exit(1);
}

// Windows updates through the NSIS installer: it is the artifact Tauri signs
// for the updater, and the one that can replace a running installation.
const bridgePath = path.join(root, "scripts/release/bridge-3.4.0.json");
const bridge = version === "3.4.0" ? undefined : JSON.parse(readFileSync(bridgePath, "utf8"));
const lastOldKey = JSON.parse(readFileSync(path.join(root, "scripts/release/old-key-4.0.0.json"), "utf8"));
const manifests = releaseManifests(
  version,
  readFileSync(signaturePath, "utf8").trim(),
  new Date().toISOString(),
  bridge,
  lastOldKey,
);
const serialize = (manifest) => `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(path.join(directory, "latest.json"), serialize(manifests.legacy), "utf8");
if (manifests.oldKey) {
  writeFileSync(path.join(directory, "tools4devs.json"), serialize(manifests.oldKey), "utf8");
  writeFileSync(path.join(directory, "tools4devs-updates.json"), serialize(manifests.current), "utf8");
} else {
  writeFileSync(path.join(directory, "tools4devs.json"), serialize(manifests.current), "utf8");
}
if (version === "3.4.0") writeFileSync(bridgePath, serialize(manifests.current), "utf8");
console.log(
  manifests.oldKey
    ? `tools4devs-updates.json: ${manifests.current.version}; tools4devs.json: ${manifests.oldKey.version}; latest.json: ${manifests.legacy.version}`
    : `tools4devs.json: ${manifests.current.version}; latest.json: ${manifests.legacy.version}`,
);
console.log(`  url: ${manifests.current.platforms["windows-x86_64"].url}`);
