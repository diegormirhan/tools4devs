/**
 * Writes the `latest.json` the app checks on launch.
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
 * The result belongs in the GitHub release beside the installers, because the
 * endpoint points at `/releases/latest/download/latest.json`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
const manifest = {
  version,
  notes: `See the release notes for ${version}.`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: readFileSync(signaturePath, "utf8").trim(),
      url: `https://github.com/diegormirhan/toolhaven-desktop/releases/download/v${version}/${installer}`,
    },
  },
};

const output = path.join(directory, "latest.json");
const document = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(output, document, "utf8");
writeFileSync(path.join(directory, "tools4devs.json"), document, "utf8");
console.log(`latest.json written for ${version}`);
console.log(`  url: ${manifest.platforms["windows-x86_64"].url}`);
